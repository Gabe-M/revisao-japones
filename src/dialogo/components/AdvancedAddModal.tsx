import React, { useState } from 'react';

interface AdvancedAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (textoPalavras: string, quantidade: number) => void;
}

export default function AdvancedAddModal({ isOpen, onClose, onGenerate }: AdvancedAddModalProps) {
    const [texto, setTexto] = useState('');
    const [quantidade, setQuantidade] = useState(3);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!texto.trim()) {
            alert('Por favor, digite pelo menos uma palavra.');
            return;
        }
        onGenerate(texto, quantidade);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] backdrop-blur-md animate-[fadeInBg_0.2s_ease-out]">
            <form 
                onSubmit={handleSubmit} 
                className="bg-[#181818] border border-[#2c2c2c] rounded-2xl p-7 max-w-[450px] w-[90%] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4),0_10px_10px_-5px_rgba(0,0,0,0.2)] animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] flex flex-col gap-5 text-gray-200"
            >
                <h3 className="m-0 text-xl font-extrabold text-center bg-gradient-to-r from-white to-[#e67e22] bg-clip-text text-transparent">
                    ✨ Adição Avançada de Vocabulário
                </h3>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-300">
                        Palavras específicas (Português, Romaji ou Japonês):
                    </label>
                    <textarea
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        placeholder="Ex: carro, comer, aeroporto, 食べる (separadas por vírgula ou uma por linha)"
                        rows={4}
                        className="w-full p-3 rounded-lg border border-[#2c2c2c] bg-[#121212] text-gray-100 text-sm outline-none focus:border-[#e67e22] transition-colors resize-none"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-300">
                            Quantidade Automática:
                        </label>
                        <span className="text-sm font-extrabold text-[#e67e22] bg-[#e67e22]/10 px-2 py-0.5 rounded">
                            {quantidade}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={quantidade}
                        onChange={e => setQuantidade(Number(e.target.value))}
                        className="w-full accent-[#e67e22] cursor-pointer"
                    />
                    <span className="text-xs text-gray-500 leading-normal">
                        Caso digite menos palavras que a quantidade selecionada, a IA complementará automaticamente com outros termos relevantes.
                    </span>
                </div>

                <div className="flex gap-3 justify-end mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-[#e67e22] hover:bg-[#d35400] text-white shadow-md shadow-[#e67e22]/10 transition-colors cursor-pointer"
                    >
                        Gerar / Adicionar
                    </button>
                </div>
            </form>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInBg {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}} />
        </div>
    );
}
