import React from 'react';

interface AiFallbackPopupProps {
    isOpen: boolean;
    errorMessage: string;
    onRetryGemini: () => void;
    onFallbackOpenAI: () => void;
    onFallbackPollinations: () => void;
    onCancel: () => void;
}

export default function AiFallbackPopup({ isOpen, errorMessage, onRetryGemini, onFallbackOpenAI, onFallbackPollinations, onCancel }: AiFallbackPopupProps) {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
            animation: 'fadeInBg 0.2s ease-out'
        }}>
            <div style={{
                background: 'var(--card-bg)',
                borderRadius: '16px',
                padding: '30px',
                maxWidth: '450px',
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{
                    fontSize: '3em',
                    marginBottom: '15px'
                }}>
                    ✨⚠️
                </div>
                
                <h3 style={{
                    margin: '0 0 10px 0',
                    color: 'var(--text-color)',
                    fontSize: '1.3em',
                    fontWeight: 600
                }}>
                    Falha na Conexão com Gemini
                </h3>

                <p style={{
                    fontSize: '0.95em',
                    color: 'gray',
                    margin: '0 0 20px 0',
                    lineHeight: '1.5'
                }}>
                    Ocorreu um erro ao gerar o conteúdo usando o Gemini. Escolha outra opção ou tente novamente:
                </p>

                {errorMessage && (
                    <details style={{
                        textAlign: 'left',
                        background: 'rgba(0, 0, 0, 0.05)',
                        padding: '10px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        fontSize: '0.8em',
                        color: '#e74c3c',
                        border: '1px solid rgba(231, 76, 60, 0.1)'
                    }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Ver detalhes do erro</summary>
                        <p style={{ margin: '5px 0 0 0', wordBreak: 'break-all', fontFamily: 'monospace' }}>{errorMessage}</p>
                    </details>
                )}

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <button 
                        onClick={onFallbackPollinations}
                        style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#8e44ad',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1em',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            boxShadow: '0 4px 6px rgba(142, 68, 173, 0.15)'
                        }}
                    >
                        🪐 Usar Pollinations (Llama 3.1 Grátis)
                    </button>

                    <button 
                        onClick={onFallbackOpenAI}
                        style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#10a37f',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1em',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            boxShadow: '0 4px 6px rgba(16, 163, 127, 0.15)'
                        }}
                    >
                        ⚡ Usar OpenAI (ChatGPT - Paga)
                    </button>
                    
                    <button 
                        onClick={onRetryGemini}
                        style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--highlight-color)',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1em',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }}
                    >
                        🔄 Tentar novamente com Gemini
                    </button>

                    <button 
                        onClick={onCancel}
                        style={{
                            padding: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-color)',
                            fontSize: '0.9em',
                            cursor: 'pointer',
                            opacity: 0.7
                        }}
                    >
                        Cancelar
                    </button>
                </div>
            </div>

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
