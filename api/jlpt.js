/**
 * Endpoint dedicado para classificar termos japoneses por nível JLPT.
 * Retorna um mapa simples { termo: "N5" } sem encapsulamentos extras.
 */
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
    let apiKey = (clientKey && clientKey.trim() && clientKey !== 'undefined') ? clientKey.trim() : (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);

    if (apiKey) {
        apiKey = apiKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }

    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
        return res.status(401).json({ error: 'Chave de API da OpenAI não configurada.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const termos = body.termos || [];

        if (!termos || termos.length === 0) {
            return res.status(200).json({});
        }

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
            max_completion_tokens: 600 // Economia de tokens de saída
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
            console.error('Erro OpenAI JLPT:', data);
            const openAIErrorMsg = data?.error?.message || (typeof data === 'string' ? data : JSON.stringify(data));
            return res.status(500).json({ 
                error: 'Falha na API OpenAI ao classificar termos JLPT', 
                message: `Falha ao conectar com a OpenAI. Detalhes: "${openAIErrorMsg}"`,
                detalhes: data 
            });
        }

        const text = data.choices?.[0]?.message?.content || '{}';

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
