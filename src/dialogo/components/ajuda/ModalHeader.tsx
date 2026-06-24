import React from 'react';
import { X } from 'lucide-react';

interface ModalHeaderProps {
    title: string;
    onClose: () => void;
    icon?: React.ReactNode;
}

export default function ModalHeader({ title, onClose, icon }: ModalHeaderProps) {
    return (
        <div className="flex items-center justify-between p-[18px] px-6 pb-3 border-b border-[var(--border-color)]/10 shrink-0">
            <h2 className="m-0 text-[1.05em] font-bold flex items-center gap-2 text-[var(--text-color)]">
                {icon}
                {title}
            </h2>
            <button
                onClick={onClose}
                className="bg-transparent border-none text-[var(--text-color)] cursor-pointer p-1.5 rounded-full flex items-center justify-center opacity-55 transition-all duration-200 hover:opacity-100 hover:bg-white/10 dark:hover:bg-white/5 active:scale-95"
            >
                <span className="sr-only">Fechar</span>
                <X size={20} />
            </button>
        </div>
    );
}
