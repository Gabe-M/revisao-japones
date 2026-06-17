import React from 'react';

interface AiLoaderProps {
    provider: 'gemini' | 'openai';
    message: string;
}

export default function AiLoader({ provider, message }: AiLoaderProps) {
    const isGemini = provider === 'gemini';
    
    // Direct GIF URLs extracted from IconScout pages
    const geminiGif = "https://cdnl.iconscout.com/lottie/premium/thumb/gemini-logo-animation-gif-download-10900314.gif";
    const openAiGif = "https://cdnl.iconscout.com/lottie/premium/thumb/chatgpt-animation-gif-download-6633794.gif";
    
    const logoSrc = isGemini ? geminiGif : openAiGif;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '45px 25px',
            textAlign: 'center',
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-subtle)',
            maxWidth: '450px',
            margin: '40px auto',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Animated Logo Container */}
            <div style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: isGemini ? 'rgba(10, 110, 240, 0.05)' : 'rgba(16, 163, 127, 0.05)',
                border: `1px solid ${isGemini ? 'rgba(10, 110, 240, 0.1)' : 'rgba(16, 163, 127, 0.1)'}`
            }}>
                <img 
                    src={logoSrc} 
                    alt={isGemini ? "Gemini Logo" : "OpenAI ChatGPT Logo"}
                    style={{
                        width: '90px',
                        height: '90px',
                        objectFit: 'contain'
                    }}
                />
            </div>

            {/* Loading text with animated ellipsis */}
            <h3 style={{ 
                margin: '10px 0', 
                fontWeight: 600,
                color: 'var(--text-color)',
                fontSize: '1.2em',
                letterSpacing: '-0.3px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                {message}
                <span className="dot-pulse" style={{ display: 'inline-flex', gap: '3px' }}>
                    <span>.</span><span>.</span><span>.</span>
                </span>
            </h3>

            <p style={{
                fontSize: '0.85em',
                color: 'gray',
                margin: '5px 0 25px 0'
            }}>
                {isGemini ? "O Gemini está processando a requisição..." : "A OpenAI está respondendo..."}
            </p>

            {/* Attribution Link (IconScout requirements) */}
            <div style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: '15px',
                width: '100%',
                fontSize: '0.75em',
                color: 'gray',
                lineHeight: '1.4'
            }}>
                {isGemini ? (
                    <span dangerouslySetInnerHTML={{ __html: `gif do gemini <a href="https://iconscout.com/lottie-animations/gemini-logo" class="text-underline font-size-sm" target="_blank" style="color: var(--highlight-color); text-decoration: underline;">Gemini Logo</a> by <a href="https://iconscout.com/contributors/cevriemann" class="text-underline font-size-sm" style="color: var(--text-color); text-decoration: underline;">CevRiemann</a> on <a href="https://iconscout.com" class="text-underline font-size-sm" style="color: var(--text-color); text-decoration: underline;">IconScout</a>` }} />
                ) : (
                    <span dangerouslySetInnerHTML={{ __html: `gif da openAI: <a href="https://iconscout.com/lottie-animations/chatgpt" class="text-underline font-size-sm" target="_blank" style="color: var(--highlight-color); text-decoration: underline;">Chatgpt</a> by <a href="https://iconscout.com/contributors/alamin" class="text-underline font-size-sm" style="color: var(--text-color); text-decoration: underline;">Al Amin</a> on <a href="https://iconscout.com" class="text-underline font-size-sm" style="color: var(--text-color); text-decoration: underline;">IconScout</a>` }} />
                )}
            </div>

            {/* Embed keyframes styles inside component if we want inline animations */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .dot-pulse span {
                    animation: pulse 1.4s infinite both;
                }
                .dot-pulse span:nth-child(2) {
                    animation-delay: .2s;
                }
                .dot-pulse span:nth-child(3) {
                    animation-delay: .4s;
                }
                @keyframes pulse {
                    0% { opacity: .2; }
                    20% { opacity: 1; }
                    100% { opacity: .2; }
                }
            `}} />
        </div>
    );
}
