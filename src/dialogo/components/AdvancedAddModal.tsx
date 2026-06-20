import React, { useState } from 'react';

interface AdvancedAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (textoPalavras: string, quantidade: number) => void;
}

export default function AdvancedAddModal({ isOpen, onClose, onGenerate }: AdvancedAddModalProps) {
    const [texto, setTexto] = useState('');
    const [quantidade, setQuantidade] = useState(3);
    const [isCancelHovered, setIsCancelHovered] = useState(false);
    const [isSubmitHovered, setIsSubmitHovered] = useState(false);

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
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(5px)',
            animation: 'fadeInBg 0.2s ease-out'
        }}>
            <form 
                onSubmit={handleSubmit} 
                style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '24px',
                    maxWidth: '450px',
                    width: '90%',
                    boxShadow: 'var(--shadow-hover)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    color: 'var(--text-color)',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxSizing: 'border-box'
                }}
            >
                <h3 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    color: 'var(--highlight-color)'
                }}>
                    ✨ Adição Avançada de Vocabulário
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        color: 'var(--text-color)',
                        opacity: 0.85
                    }}>
                        Palavras específicas (Português, Romaji ou Japonês):
                    </label>
                    <textarea
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        placeholder="Ex: carro, comer, aeroporto, 食べる (separadas por vírgula ou uma por linha)"
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-color)',
                            color: 'var(--text-color)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            resize: 'none',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--highlight-color)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            color: 'var(--text-color)',
                            opacity: 0.85
                        }}>
                            Quantidade Automática:
                        </label>
                        <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            color: 'var(--highlight-color)',
                            background: 'rgba(230, 126, 34, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                        }}>
                            {quantidade}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={quantidade}
                        onChange={e => setQuantidade(Number(e.target.value))}
                        style={{
                            width: '100%',
                            cursor: 'pointer',
                            accentColor: 'var(--highlight-color)'
                        }}
                    />
                    <span style={{
                        fontSize: '0.75rem',
                        color: 'gray',
                        lineHeight: '1.4'
                    }}>
                        Caso digite menos palavras que a quantidade selecionada, a IA complementará automaticamente com outros termos relevantes.
                    </span>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end',
                    marginTop: '8px'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        onMouseEnter={() => setIsCancelHovered(true)}
                        onMouseLeave={() => setIsCancelHovered(false)}
                        style={{
                            padding: '8px 16px',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: isCancelHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                            color: 'var(--text-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Cancelar
                    </button>
                    
                    <button
                        type="submit"
                        onMouseEnter={() => setIsSubmitHovered(true)}
                        onMouseLeave={() => setIsSubmitHovered(false)}
                        style={{
                            padding: '8px 16px',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--highlight-color)',
                            filter: isSubmitHovered ? 'brightness(1.1)' : 'none',
                            color: 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 10px rgba(230, 126, 34, 0.2)'
                        }}
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
