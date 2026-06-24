import React from 'react';
import InteractiveText from '../../../components/InteractiveText';

interface ChatBubbleProps {
    mensagem: string;
    sender?: string;
    avatar?: string;
}

export default function ChatBubble({ mensagem, sender = 'IA', avatar = '✨' }: ChatBubbleProps) {
    return (
        <div className="flex items-start gap-2.5 mb-0 shrink-0">
            {/* AI avatar */}
            <div
                className="shrink-0 w-[30px] h-[30px] rounded-full bg-[var(--highlight-color)] flex items-center justify-center text-xs mt-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                aria-hidden="true"
            >
                {avatar}
            </div>
            {/* Bubble body */}
            <div className="flex-1 p-3 px-4 rounded-2xl bg-slate-100/80 dark:bg-white/5 border-none shadow-sm text-slate-700 dark:text-slate-200">
                <div className="text-[0.7rem] font-bold text-[var(--highlight-color)] uppercase tracking-[0.6px] mb-1.5 opacity-85">
                    {sender}
                </div>
                <div className="text-[1.08em] leading-relaxed">
                    <InteractiveText text={mensagem} />
                </div>
            </div>
        </div>
    );
}
