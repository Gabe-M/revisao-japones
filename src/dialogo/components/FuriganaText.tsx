import React from 'react';

interface FuriganaTextProps {
    text: string;
    fallbackLeitura?: string;
    onWordClick?: (word: string, reading: string, sentence?: string) => void;
}

export default function FuriganaText({ text, fallbackLeitura, onWordClick }: FuriganaTextProps) {
    // Parser for ruby tags and words
    const renderContent = () => {
        if (!text) return null;

        let normalizedText = text.replace(/<ruby>([\s\S]*?)<\/ruby>\s*<rt>([\s\S]*?)<\/rt>/gi, '<ruby>$1<rt>$2</rt></ruby>');
        // Correção para quando a IA fecha </rt> antes de iniciar <rt>
        normalizedText = normalizedText.replace(/<ruby>([\s\S]*?)<\/rt>\s*<rt>/gi, '<ruby>$1<rt>');
        
        // Remove empty ruby tags that do not contain any furigana (rt tag)
        // e.g. <ruby>を</ruby> -> を
        normalizedText = normalizedText.replace(/<ruby>([^<]*?)<\/ruby>/g, '$1');

        // Remove all HTML tags except ruby tags (<ruby>, </ruby>, <rt>, </rt>, <rp>, </rp>)
        normalizedText = normalizedText.replace(/<(?!ruby\b|\/ruby\b|rt\b|\/rt\b|rp\b|\/rp\b)[^>]+>/gi, '');
        // Also remove markdown styling characters (like *, _, `)
        normalizedText = normalizedText.replace(/[\*\`\_]/g, '');

        const segments: React.ReactNode[] = [];
        let currentIndex = 0;
        
        // Regex to match <ruby>...</ruby>
        const rubyRegex = /<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/g;
        let match;

        // Try to use Intl.Segmenter for Japanese word splitting
        const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter 
            ? new (Intl as any).Segmenter('ja-JP', { granularity: 'word' }) 
            : null;

        const processTextSegment = (str: string, keyPrefix: string) => {
            if (!str) return [];
            
            const nodes: React.ReactNode[] = [];
            if (onWordClick && segmenter) {
                const parts = Array.from(segmenter.segment(str));
                parts.forEach((part: any, idx) => {
                    if (part.segment.trim()) {
                        nodes.push(
                            <span 
                                key={`${keyPrefix}-word-${idx}`} 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onWordClick(part.segment, '', normalizedText);
                                }}
                                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                                onMouseOver={e => { e.currentTarget.style.color = 'var(--highlight-color)'; }}
                                onMouseOut={e => { e.currentTarget.style.color = 'inherit'; }}
                            >
                                {part.segment}
                            </span>
                        );
                    } else {
                        nodes.push(<span key={`${keyPrefix}-space-${idx}`}>{part.segment}</span>);
                    }
                });
            } else {
                // Fallback if segmenter is not available
                nodes.push(
                    <span 
                        key={`${keyPrefix}-text`}
                        onClick={(e) => {
                            if (onWordClick) {
                                e.stopPropagation();
                                onWordClick(str, '', normalizedText);
                            }
                        }}
                        style={{ cursor: onWordClick ? 'pointer' : 'inherit' }}
                    >
                        {str}
                    </span>
                );
            }
            return nodes;
        };

        while ((match = rubyRegex.exec(normalizedText)) !== null) {
            // Text before the ruby tag
            if (match.index > currentIndex) {
                const beforeText = normalizedText.substring(currentIndex, match.index);
                segments.push(...processTextSegment(beforeText, `before-${currentIndex}`));
            }

            // The ruby tag itself
            const kanji = match[1];
            const reading = match[2];
            segments.push(
                <ruby 
                    key={`ruby-${match.index}`}
                    onClick={(e) => {
                        if (onWordClick) {
                            e.stopPropagation();
                            onWordClick(kanji, reading, normalizedText);
                        }
                    }}
                    style={{ cursor: onWordClick ? 'pointer' : 'inherit', transition: 'color 0.2s' }}
                    onMouseOver={e => { if(onWordClick) e.currentTarget.style.color = 'var(--highlight-color)'; }}
                    onMouseOut={e => { if(onWordClick) e.currentTarget.style.color = 'inherit'; }}
                >
                    {kanji}
                    <rt>{reading}</rt>
                </ruby>
            );

            currentIndex = rubyRegex.lastIndex;
        }

        // Text after the last ruby tag
        if (currentIndex < normalizedText.length) {
            const afterText = normalizedText.substring(currentIndex);
            segments.push(...processTextSegment(afterText, `after-${currentIndex}`));
        }

        // If no ruby tags were found, maybe just process the whole text or check fallback
        if (segments.length === 0) {
            const hasKanji = /[\u4e00-\u9faf]/.test(normalizedText);
            if (hasKanji && fallbackLeitura) {
                return (
                    <ruby 
                        onClick={(e) => {
                            if (onWordClick) {
                                e.stopPropagation();
                                onWordClick(normalizedText, fallbackLeitura, normalizedText);
                            }
                        }}
                        style={{ cursor: onWordClick ? 'pointer' : 'inherit' }}
                    >
                        {normalizedText}
                        <rt>{fallbackLeitura}</rt>
                    </ruby>
                );
            }
            return <>{processTextSegment(normalizedText, 'all')}</>;
        }

        return <>{segments}</>;
    };

    return <span className="furigana-container">{renderContent()}</span>;
}
