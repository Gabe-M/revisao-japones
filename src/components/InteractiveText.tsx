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

  const parseHtmlToReact = (html: string): React.ReactNode[] => {
    if (!html) return [];
    
    const stripTags = (str: string) => str.replace(/<\/?(?:w|rt|ruby|rp)[^>]*>/gi, '');

    // 1. Normalize common LLM syntax errors in HTML tags
    let normalized = html
      // Fix LLM writing </rt> instead of <rt> right after <ruby>... (e.g. <ruby>人</rt> -> <ruby>人<rt>)
      .replace(/<ruby>([\s\S]*?)<\/rt>/gi, '<ruby>$1<rt>')
      // Fix duplicate consecutive </rt></rt>
      .replace(/<\/rt>\s*<\/rt>/gi, '</rt>')
      // Fix missing </rt> before </ruby> (e.g. <ruby>人<rt>ひと</ruby> -> <ruby>人<rt>ひと</rt></ruby>)
      .replace(/<ruby>([\s\S]*?)<rt>([^<]*?)<\/ruby>/gi, '<ruby>$1<rt>$2</rt></ruby>')
      // Fix detached <rt> after </ruby> (e.g. <ruby>Kanji</ruby><rt>furigana</rt>)
      .replace(/<ruby>([\s\S]*?)<\/ruby>\s*<rt>([\s\S]*?)<\/rt>/gi, '<ruby>$1<rt>$2</rt></ruby>');

    // 2. Fix unclosed <w> tags generated by LLMs (e.g. <w>は <w>です -> <w>は</w> <w>です</w>)
    normalized = normalized.replace(/<w>([\s\S]*?)(?=(?:<w>|<\/w>|<ruby>|$))/gi, (match, content) => {
      if (!match.toLowerCase().endsWith('</w>')) {
        return `<w>${content}</w>`;
      }
      return match;
    });

    // Clean any unsupported HTML tags
    let cleanedHtml = normalized.replace(/<(?!ruby\b|\/ruby\b|rt\b|\/rt\b|rp\b|\/rp\b|w\b|\/w\b)[^>]+>/gi, '');

    const hasW = /<w>[\s\S]*?<\/w>/i.test(cleanedHtml);

    if (hasW) {
      const parts: React.ReactNode[] = [];
      const wRegex = /(<w>[\s\S]*?<\/w>)/gi;
      const splitW = cleanedHtml.split(wRegex);

      splitW.forEach((part, index) => {
        const trimmedPart = part.trim();
        if (trimmedPart.toLowerCase().startsWith('<w>') && trimmedPart.toLowerCase().endsWith('</w>')) {
          const innerContent = part.replace(/^<w>|<\/w>$/gi, '');
          // Parse any ruby tags inside the <w> tag
          const innerNodes = parseHtmlToReact(innerContent);
          parts.push(
            <span key={`w-${index}`} className="interactive-word">
              {innerNodes}
            </span>
          );
        } else if (part) {
          if (part.toLowerCase().includes('<ruby>')) {
            parts.push(...parseHtmlToReact(part));
          } else {
            const cleanText = stripTags(part);
            if (cleanText) {
              parts.push(
                <span key={`text-${index}`} className="non-interactive" style={{ whiteSpace: 'pre-wrap' }}>
                  {cleanText}
                </span>
              );
            }
          }
        }
      });
      return parts;
    }

    const parts: React.ReactNode[] = [];
    const regex = /(<ruby>[\s\S]*?<\/ruby>)/gi;
    const splitParts = cleanedHtml.split(regex);
    
    splitParts.forEach((part, index) => {
      const trimmedPart = part.trim();
      if (trimmedPart.toLowerCase().startsWith('<ruby>') && trimmedPart.toLowerCase().endsWith('</ruby>')) {
        const rubyMatch = /<ruby>([\s\S]*?)<rt>([\s\S]*?)<\/rt><\/ruby>/i.exec(trimmedPart);
        if (rubyMatch) {
          const kanji = stripTags(rubyMatch[1]).trim();
          const reading = stripTags(rubyMatch[2]).trim();
          parts.push(
            <ruby key={`ruby-${index}`}>
              {kanji}
              <rt>{reading}</rt>
            </ruby>
          );
        } else {
          const cleanFallback = stripTags(part);
          if (cleanFallback) parts.push(<span key={`raw-html-${index}`}>{cleanFallback}</span>);
        }
      } else if (part) {
        const cleanText = stripTags(part);
        if (cleanText) parts.push(cleanText);
      }
    });
    
    return parts;
  };

  const processNode = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      return segmentString(node);
    }
    if (React.isValidElement(node)) {
      return node;
    }
    return node;
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
    const hasW = textToUse.toLowerCase().includes('<w>') || textToUse.toLowerCase().includes('</w>');
    if (!hasW) {
      contentNode = parseHtmlToReact(textToUse).map(processNode);
    } else {
      contentNode = parseHtmlToReact(textToUse);
    }
  } else if (children !== undefined) {
    contentNode = React.Children.map(children, processNode);
  }

  return (
    <>
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
      <style dangerouslySetInnerHTML={{__html: `
        .interactive-text-container {
          display: inline-block;
          -webkit-user-drag: none;
          user-drag: none;
        }

        .interactive-text-container .interactive-word { 
          transition: all 0.2s ease; 
          cursor: pointer; 
          padding: 0 2px; 
          border-radius: 4px; 
          display: inline !important;
          -webkit-user-drag: none;
          user-drag: none;
        }

        .interactive-text-container ruby { 
          transition: all 0.2s ease; 
          cursor: pointer; 
          padding: 0 2px; 
          border-radius: 4px; 
          display: ruby !important;
          -webkit-user-drag: none;
          user-drag: none;
        }

        .interactive-text-container:not(.selecting-text) .interactive-word:hover, 
        .interactive-text-container:not(.selecting-text) ruby:hover { 
          background: linear-gradient(135deg, #ff6b6b, #c0392b) !important; 
          color: #ffffff !important; 
        }

        .interactive-text-container:not(.selecting-text) .interactive-word:hover *,
        .interactive-text-container:not(.selecting-text) ruby:hover rt {
          color: #ffffff !important;
        }

        .interactive-text-container,
        .interactive-text-container ruby,
        .interactive-text-container .interactive-word,
        .interactive-text-container .non-interactive {
          user-select: text !important;
          -moz-user-select: text !important;
          -webkit-user-select: text !important;
        }

        .interactive-text-container rt {
          pointer-events: none;
        }

        .interactive-text-container ::selection {
          background-color: var(--highlight-color, #ff6b6b);
          color: white;
        }
        .interactive-text-container *::selection {
          background-color: var(--highlight-color, #ff6b6b);
          color: white;
        }
        .interactive-text-container ::-moz-selection {
          background-color: var(--highlight-color, #ff6b6b);
          color: white;
        }
        .interactive-text-container *::-moz-selection {
          background-color: var(--highlight-color, #ff6b6b);
          color: white;
        }
      `}} />
    </>
  );
}
