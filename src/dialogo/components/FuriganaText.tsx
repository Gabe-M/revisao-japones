import React from 'react';

interface FuriganaTextProps {
    text: string;
    fallbackLeitura?: string;
}

export default function FuriganaText({ text, fallbackLeitura }: FuriganaTextProps) {
    // Se o texto já vier com tags <ruby> da IA, renderizamos como HTML seguro
    if (text.includes('<ruby>')) {
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    }

    // Se tiver kanji e uma leitura fallback, montamos um ruby simples
    const hasKanji = /[\u4e00-\u9faf]/.test(text);
    
    if (hasKanji && fallbackLeitura) {
        return (
            <ruby>
                {text}
                <rt>{fallbackLeitura}</rt>
            </ruby>
        );
    }

    return <span>{text}</span>;
}
