import { useState, useEffect, useCallback, useRef } from 'react';

export function useJapaneseTTS() {
    const [isPlaying, setIsPlaying] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const speak = useCallback((texto: string) => {
        if (!texto) return;

        // Clean Furigana <rt> and HTML tags to avoid repeating text and HTML syntax reading
        const textoLimpo = texto
            .replace(/<rt>.*?<\/rt>/g, '')
            .replace(/<[^>]+>/g, '');

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(textoLimpo);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;

        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, []);

    const stop = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }, []);

    // Cleanup: cancel speech synthesis when hook is unmounted (i.e. tab change or component destroy)
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    return { speak, stop, isPlaying };
}
