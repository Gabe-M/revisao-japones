import React from 'react';
import AiLoader from '../AiLoader';
import VocabularyPill from './VocabularyPill';

interface VocabularyRibbonProps {
    vocabulario: any[];
    loadingVocab: boolean;
    provider: string;
}

export default function VocabularyRibbon({ vocabulario, loadingVocab, provider }: VocabularyRibbonProps) {
    if (loadingVocab) {
        return (
            <div className="flex-shrink-0 py-1 flex items-center justify-center">
                <AiLoader provider={provider} message="Analisando vocabulário..." />
            </div>
        );
    }

    if (!vocabulario || vocabulario.length === 0) return null;

    return (
        <div className="shrink-0">
            {/* Horizontal scrolling micro-pill ribbon */}
            <div className="flex flex-row flex-nowrap overflow-x-auto gap-2 w-full whitespace-nowrap pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {vocabulario.map((v, idx) => (
                    <VocabularyPill
                        key={idx}
                        item={v.item}
                        leitura={v.leitura}
                        significado={v.significado}
                    />
                ))}
            </div>
        </div>
    );
}
