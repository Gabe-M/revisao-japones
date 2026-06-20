import React, { useRef } from 'react';
import { useTermCard } from '../context/TermCardContext';

interface InteractiveTextProps {
  text?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function InteractiveText({ text, children, className, style }: InteractiveTextProps) {
  const { openCard } = useTermCard();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = (e.target as HTMLElement).closest('.interactive-word, ruby') as HTMLElement;
    if (!target) return;

    let term = '';
    if (target.tagName.toLowerCase() === 'ruby') {
      // Clone the ruby node to prevent altering the live DOM
      const clone = target.cloneNode(true) as HTMLElement;
      // Iteratively remove all <rt> elements (furigana readings)
      const rts = clone.querySelectorAll('rt');
      rts.forEach(rt => rt.remove());
      term = clone.textContent?.trim() || '';
    } else {
      term = target.textContent?.trim() || '';
    }

    if (!term) return;

    // Capture coordinates and context
    const x = e.clientX;
    const y = e.clientY;
    // CurrentTarget represents the .interactive-text-container element itself
    const fraseCompleta = e.currentTarget.textContent?.trim() || '';

    openCard(term, fraseCompleta, x, y);
  };

  const segmentString = (content: string): React.ReactNode[] => {
    try {
      const segmenter = new (Intl as any).Segmenter('ja', { granularity: 'word' });
      const segments = Array.from(segmenter.segment(content)) as any[];
      return segments.map((seg, idx) => {
        if (seg.isWordLike) {
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
    const parts: React.ReactNode[] = [];
    const regex = /(<ruby>.*?<\/ruby>)/g;
    const splitParts = html.split(regex);
    
    splitParts.forEach((part, index) => {
      if (part.startsWith('<ruby>') && part.endsWith('</ruby>')) {
        const rubyMatch = /<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/.exec(part);
        if (rubyMatch) {
          const kanji = rubyMatch[1];
          const reading = rubyMatch[2];
          parts.push(
            <ruby key={`ruby-${index}`}>
              {kanji}
              <rt>{reading}</rt>
            </ruby>
          );
        } else {
          parts.push(<span key={`raw-html-${index}`} dangerouslySetInnerHTML={{ __html: part }} />);
        }
      } else if (part) {
        parts.push(part);
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
    display: 'inline-block'
  };

  let contentNode: React.ReactNode = null;
  if (text !== undefined) {
    contentNode = parseHtmlToReact(text).map(processNode);
  } else if (children !== undefined) {
    contentNode = React.Children.map(children, processNode);
  }

  return (
    <div 
      ref={containerRef}
      className={`interactive-text-container ${className || ''}`}
      style={containerStyle}
      onClick={handleClick}
    >
      {contentNode}
    </div>
  );
}
