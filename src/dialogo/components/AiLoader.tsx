import React from 'react';

interface AiLoaderProps {
    provider: 'gemini' | 'openai' | 'groq' | 'pollinations';
    message: string;
}

export default function AiLoader({ provider, message }: AiLoaderProps) {
    const isGemini = provider === 'gemini' || provider === 'pollinations';
    
    // Direct GIF URLs extracted from IconScout pages
    const geminiGif = "https://cdnl.iconscout.com/lottie/premium/thumb/gemini-logo-animation-gif-download-10900314.gif";
    const openAiGif = "https://cdnl.iconscout.com/lottie/premium/thumb/chatgpt-animation-gif-download-6633794.gif";
    const groqLogo = "https://raw.githubusercontent.com/lobehub/lobe-icons/main/icons/groq.svg";
    
    let logoSrc = openAiGif;
    if (provider === 'gemini' || provider === 'pollinations') {
        logoSrc = geminiGif;
    } else if (provider === 'groq') {
        logoSrc = groqLogo;
    }

    let bg = isGemini ? 'rgba(10, 110, 240, 0.05)' : 'rgba(16, 163, 127, 0.05)';
    let border = `${isGemini ? 'rgba(10, 110, 240, 0.1)' : 'rgba(16, 163, 127, 0.1)'}`;
    
    if (provider === 'pollinations') {
        bg = 'rgba(142, 68, 173, 0.05)';
        border = 'rgba(142, 68, 173, 0.1)';
    } else if (provider === 'groq') {
        bg = 'rgba(230, 126, 34, 0.05)';
        border = 'rgba(230, 126, 34, 0.1)';
    }

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
                background: bg,
                border: `1px solid ${border}`
            }}>
                <img 
                    src={logoSrc} 
                    alt={provider === 'gemini' ? "Gemini Logo" : provider === 'groq' ? "Groq Logo" : "OpenAI ChatGPT Logo"}
                    style={{
                        width: '90px',
                        height: '90px',
                        objectFit: 'contain',
                        animation: provider === 'groq' ? 'groqPulse 2s infinite ease-in-out' : 'none'
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
                {provider === 'gemini' && "O Gemini está processando a requisição..."}
                {provider === 'openai' && "A OpenAI está respondendo..."}
                {provider === 'groq' && "A Groq LPU está processando em alta velocidade..."}
                {provider === 'pollinations' && "O Pollinations.ai (Llama 3.1) está respondendo de graça..."}
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
                {provider === 'gemini' || provider === 'pollinations' ? (
                    <span dangerouslySetInnerHTML={{ __html: `gif do gemini/pollinations: <a href="https://iconscout.com/lottie-animations/gemini-logo" class="text-underline font-size-sm" target="_blank" style="color: var(--highlight-color); text-decoration: underline;">Gemini Logo</a> by <a href="https://iconscout.com/contributors/cevriemann" class="text-underline font-size-sm" style="color: var(--text-color); text-decoration: underline;">CevRiemann</a> on <a href="https://iconscout.com" class="text-underline font-size-sm" style="color: var(--text-color); text-decoration: underline;">IconScout</a>` }} />
                ) : provider === 'groq' ? (
                    <span dangerouslySetInnerHTML={{ __html: `logo do Groq: <a href="https://icons.lobehub.com" class="text-underline font-size-sm" target="_blank" style="color: var(--highlight-color); text-decoration: underline;">Groq Logo</a> on <a href="https://icons.lobehub.com" class="text-underline font-size-sm" style="color: var(--text-color); text-decoration: underline;">Lobe Icons</a>` }} />
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
                @keyframes groqPulse {
                    0% { transform: scale(1); filter: drop-shadow(0 0 2px #e67e22); }
                    50% { transform: scale(1.12); filter: drop-shadow(0 0 12px #e67e22); }
                    100% { transform: scale(1); filter: drop-shadow(0 0 2px #e67e22); }
                }
            `}} />
        </div>
    );
}
