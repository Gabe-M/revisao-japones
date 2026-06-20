import React from 'react';
import { useTermCard } from '../context/TermCardContext';

interface InteractiveTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function InteractiveText({ text, className, style }: InteractiveTextProps) {
  const { openCard } = useTermCard();

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection()?.toString().trim();
    
    if (selection) {
      openCard(selection, text.replace(/<[^>]*>/g, ''), e.clientX, e.clientY);
    } else {
      // Fallback para clique simples em ruby/span
      const target = e.target as HTMLElement;
      if (target && (target.tagName.toLowerCase() === 'ruby' || target.tagName.toLowerCase() === 'rt' || target.tagName.toLowerCase() === 'span')) {
        let elementToExtract = target;
        if (target.tagName.toLowerCase() === 'rt' && target.parentElement?.tagName.toLowerCase() === 'ruby') {
           elementToExtract = target.parentElement;
        }
        
        // Remove rt from textContent by cloning
        const clone = elementToExtract.cloneNode(true) as HTMLElement;
        const rts = clone.querySelectorAll('rt');
        rts.forEach(rt => rt.remove());
        
        const extractedText = clone.textContent?.trim();
        if (extractedText) {
          openCard(extractedText, text.replace(/<[^>]*>/g, ''), e.clientX, e.clientY);
        }
      }
    }
  };

  return (
    <div 
      className={className} 
      style={{ ...style, cursor: 'text' }}
      onMouseUp={handleMouseUp}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}
