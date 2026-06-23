import React, { useRef, useState, useEffect } from 'react';
import { useTermCard } from '../context/TermCardContext';

interface InteractiveTextProps {
  text?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  fallbackLeitura?: string;
}

// Module-level variable to persist selection state across React mount/unmount renders
let lastSelectionTime = 0;

export default function InteractiveText({ text, children, className, style, fallbackLeitura }: InteractiveTextProps) {
  const { openCard } = useTermCard();
  const containerRef = useRef<HTMLSpanElement>(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const mouseDownTime = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    if (!isSelecting) return;
    const handleGlobalMouseUp = () => {
      setIsSelecting(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isSelecting]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsSelecting(true);
    mouseDownTime.current = Date.now();
    startX.current = e.clientX;
    startY.current = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLSpanElement>) => {
    setIsSelecting(false);
    const selection = window.getSelection();
    if (!selection) return;
    const selectedText = selection.toString().trim();
    
    if (!selectedText) return;

    const dist = Math.hypot(e.clientX - startX.current, e.clientY - startY.current);
    const duration = Date.now() - mouseDownTime.current;
    
    // Guard clause: if not a drag/select gesture, let onClick do word navigation
    if (dist < 5 && duration < 300) {
      return;
    }

    // Capture context: surrounding sentence context
    const containerClone = e.currentTarget.cloneNode(true) as HTMLElement;
    const containerRts = containerClone.querySelectorAll('rt');
    containerRts.forEach(rt => rt.remove());
    const fraseCompleta = containerClone.textContent?.trim() || '';

    // Clear native visual highlight
    selection.removeAllRanges();
    
    // Set last selection time to block the trailing click event
    lastSelectionTime = Date.now();

    // Capture coordinates
    const x = e.clientX;
    const y = e.clientY;

    openCard(selectedText, fraseCompleta, x, y, 'SelecaoLivre');
  };

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    // If a text selection occurred recently (within 800ms), suppress word click event
    if (Date.now() - lastSelectionTime < 800) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    let target = (e.target as HTMLElement).closest('.interactive-word') as HTMLElement;
    if (!target) {
      target = (e.target as HTMLElement).closest('ruby') as HTMLElement;
    }
    if (!target) return;

    // Clone the target node to prevent altering the live DOM
    const clone = target.cloneNode(true) as HTMLElement;
    // Iteratively remove all <rt> elements (furigana readings)
    const rts = clone.querySelectorAll('rt');
    rts.forEach(rt => rt.remove());
    
    const term = clone.textContent?.trim() || '';
    if (!term) return;

    // Capture coordinates and context
    const x = e.clientX;
    const y = e.clientY;
    
    // Clone the container to remove rt (furigana) elements and get clean text context
    const containerClone = e.currentTarget.cloneNode(true) as HTMLElement;
    const containerRts = containerClone.querySelectorAll('rt');
    containerRts.forEach(rt => rt.remove());
    const fraseCompleta = containerClone.textContent?.trim() || '';

    openCard(term, fraseCompleta, x, y);
  };

  const segmentString = (content: string): React.ReactNode[] => {
    try {
      const segmenter = new (Intl as any).Segmenter('ja', { granularity: 'word' });
      const segments = Array.from(segmenter.segment(content)) as any[];
      return segments.map((seg, idx) => {
        const isJp = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(seg.segment);
        if (isJp) {
          return (
            <span key={idx} className="interactive-word">
              {seg.segment}
            </span>
          );
        } else {
          return (
            <span key={idx} className="non-interactive" style={{ whiteSpace: 'pre-wrap' }}>
              {seg.segment}
            </span>
          );
        }
      });
    } catch (e) {
      // Fallback in case Intl.Segmenter is not supported by the environment
      return [<span key="fallback" className="non-interactive" style={{ whiteSpace: 'pre-wrap' }}>{content}</span>];
    }
  };

  const parseHtmlToReact = (htmlString: string): React.ReactNode[] => {
    let normalized = htmlString.replace(/<ruby>([\s\S]*?)<\/ruby>\s*<rt>([\s\S]*?)<\/rt>/gi, '<ruby>$1<rt>$2</rt></ruby>');
    normalized = normalized.replace(/<ruby>([\s\S]*?)<\/rt>\s*<rt>/gi, '<ruby>$1<rt>');

    const doc = new DOMParser().parseFromString(normalized, 'text/html');
    const hasW = !!doc.querySelector('w');

    const domToReact = (node: ChildNode, depth: number, index: number): React.ReactNode => {
      const key = `node-${depth}-${index}`;

      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent || '';
        if (!content.trim()) return content;
        
        const parentName = (node.parentNode as HTMLElement)?.nodeName?.toLowerCase();
        const inRuby = parentName === 'ruby' || parentName === 'rt';

        if (inRuby) {
            return content;
        }

        if (!hasW) {
            return <React.Fragment key={key}>{segmentString(content)}</React.Fragment>;
        } else {
            let inW = false;
            let curr = node.parentNode as HTMLElement | null;
            while (curr && curr.nodeName) {
                if (curr.nodeName.toLowerCase() === 'w') {
                    inW = true;
                    break;
                }
                curr = curr.parentNode as HTMLElement | null;
            }
            if (inW) {
                return content;
            } else {
                return <span key={key} className="non-interactive" style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
            }
        }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.nodeName.toLowerCase();
        
        const childNodes = Array.from(el.childNodes);
        const children = childNodes.map((child, i) => domToReact(child, depth + 1, i));

        if (tagName === 'w') {
          return <span key={key} className="interactive-word">{children}</span>;
        } else if (tagName === 'ruby') {
          return <ruby key={key}>{children}</ruby>;
        } else if (tagName === 'rt') {
          return <rt key={key}>{children}</rt>;
        } else if (tagName === 'body' || tagName === 'html' || tagName === 'head') {
          return <React.Fragment key={key}>{children}</React.Fragment>;
        } else {
          return null;
        }
      }

      return null;
    };

    return Array.from(doc.body.childNodes).map((node, i) => domToReact(node, 0, i));
  };

  const containerStyle: React.CSSProperties = {
    ...style,
    cursor: 'text',
    display: 'inline'
  };

  let textToUse = text;
  if (text && fallbackLeitura && text !== fallbackLeitura && /[\u4e00-\u9faf]/.test(text) && !text.includes('<ruby>') && !text.includes('<w>')) {
    textToUse = `<ruby>${text}<rt>${fallbackLeitura}</rt></ruby>`;
  }

  let contentNode: React.ReactNode = null;
  if (textToUse !== undefined) {
    contentNode = parseHtmlToReact(textToUse);
  } else if (children !== undefined) {
    contentNode = React.Children.map(children, (child, idx) => {
        if (typeof child === 'string') {
            return <React.Fragment key={`child-${idx}`}>{segmentString(child)}</React.Fragment>;
        }
        return child;
    });
  }

  return (
    <span 
      ref={containerRef}
      className={`interactive-text-container ${isSelecting ? 'selecting-text' : ''} ${className || ''}`}
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {contentNode}
    </span>
  );
}
