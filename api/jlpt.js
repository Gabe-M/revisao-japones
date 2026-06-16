async function callGeminiJLPT(termos, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `Você é um especialista em japonês e JLPT. Classifique os seguintes termos japoneses com o nível JLPT mais adequado.

Retorne SOMENTE um JSON puro (sem markdown, sem texto extra) no formato:
{"termo1": "N5", "termo2": "N4", ...}

Regras de classificação:
- N5: palavras mais básicas (eu, você, casa, comer, beber, gostar, etc.)
- N4: vocabulário elementar (comprar, esperar, entender, limpar, etc.)
- N3: vocabulário intermediário
- N2: vocabulário avançado
- N1: vocabulário muito avançado ou literário

Termos para classificar: ${JSON.stringify(termos)}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || JSON.stringify(data));
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
}

async function callOpenAIJLPT(termos, apiKey) {
    const prompt = `Você é um especialista em japonês e JLPT. Classifique os seguintes termos japoneses com o nível JLPT mais adequado.

Retorne SOMENTE um JSON puro (sem markdown, sem texto extra) no formato:
{"termo1": "N5", "termo2": "N4", ...}

Regras de classificação:
- N5: palavras mais básicas (eu, você, casa, comer, beber, gostar, etc.)
- N4: vocabulário elementar (comprar, esperar, entender, limpar, etc.)
- N3: vocabulário intermediário
- N2: vocabulário avançado
- N1: vocabulário muito avançado ou literário

Termos para classificar: ${JSON.stringify(termos)}`;

    const payload = {
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'Você é um classificador especializado em JLPT. Sempre responda em formato JSON válido.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_completion_tokens: 600
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || JSON.stringify(data));
    }

    return data.choices?.[0]?.message?.content || '{}';
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key, X-OpenAI-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const clientKey = req.headers['x-openai-key'] || req.headers['x-gemini-key'];
    let geminiKey = null;
    let openAIKey = null;

    if (clientKey) {
        const cleanedKey = clientKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (cleanedKey.startsWith('sk-')) {
            openAIKey = cleanedKey;
        } else {
            geminiKey = cleanedKey;
        }
    }

    if (!geminiKey) {
        geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') : null;
    }
    if (!openAIKey) {
        openAIKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') : null;
    }

    if (!geminiKey && !openAIKey) {
        return res.status(401).json({ error: 'Chave de API não configurada.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const termos = body.termos || [];

        if (!termos || termos.length === 0) {
            return res.status(200).json({});
        }

        let text = '{}';

        if (geminiKey) {
            try {
                console.log("[JLPT] Classificando via Gemini...");
                text = await callGeminiJLPT(termos, geminiKey);
            } catch (geminiError) {
                console.warn("[JLPT] Gemini falhou com erro:", geminiError.message);
                if (openAIKey) {
                    try {
                        console.log("[JLPT] Fazendo fallback para OpenAI...");
                        text = await callOpenAIJLPT(termos, openAIKey);
                    } catch (openAIError) {
                        console.error("[JLPT] Ambos falharam. Erro OpenAI:", openAIError.message);
                        return res.status(500).json({ 
                            error: 'Ambos os provedores de classificação JLPT falharam.',
                            message: `Gemini: "${geminiError.message}". OpenAI: "${openAIError.message}"`
                        });
                    }
                } else {
                    return res.status(500).json({ 
                        error: 'Classificador Gemini falhou e nenhum fallback OpenAI está configurado.', 
                        message: geminiError.message 
                    });
                }
            }
        } else if (openAIKey) {
            try {
                console.log("[JLPT] Classificando via OpenAI...");
                text = await callOpenAIJLPT(termos, openAIKey);
            } catch (openAIError) {
                console.error("[JLPT] OpenAI falhou com erro:", openAIError.message);
                return res.status(500).json({ 
                    error: 'Classificador OpenAI falhou.', 
                    message: openAIError.message 
                });
            }
        }

        let jlptMap = {};
        try {
            // Remove markdown caso exista
            const clean = text.replace(/^```(?:json)?|```$/gm, '').trim();
            jlptMap = JSON.parse(clean);
        } catch (e) {
            console.error('Erro ao parsear resposta JLPT:', e, text);
        }

        // Normaliza valores para garantir formato N1-N5
        const normalizado = {};
        for (const [key, val] of Object.entries(jlptMap)) {
            const match = String(val).toUpperCase().match(/N[1-5]/);
            if (match) {
                normalizado[key] = match[0];
            }
        }

        return res.status(200).json(normalizado);

    } catch (error) {
        console.error('Erro interno /api/jlpt:', error);
        return res.status(500).json({ error: error.message });
    }
}
