import React from 'react';
import InteractiveText from '../../../components/InteractiveText';

interface VocabularyPillProps {
    item: string;
    leitura?: string;
    significado?: string;
}

export default function VocabularyPill({ item, leitura, significado }: VocabularyPillProps) {
    return (
        <div className="inline-flex items-center shrink-0 px-3 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)]/20 text-xs shadow-sm text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
                <InteractiveText text={`<ruby>${item}<rt>${leitura ?? ''}</rt></ruby>`} />
            </span>
            {significado && (
                <span className="opacity-60 font-normal ml-1 text-slate-600 dark:text-slate-300">
                    ({significado})
                </span>
            )}
        </div>
    );
}
