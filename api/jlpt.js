/**
 * Endpoint dedicado para classificar termos japoneses por nível JLPT.
 * Retorna um mapa simples { termo: "N5" } sem encapsulamentos extras.
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const clientKey = req.headers['x-gemini-key'];
    let apiKey = (clientKey && clientKey.trim() && clientKey !== 'undefined') ? clientKey.trim() : process.env.GEMINI_API_KEY;

    if (apiKey) {
        apiKey = apiKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }

    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
        return res.status(401).json({ error: 'Chave de API não configurada.' });
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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
            console.error('Erro Gemini JLPT:', data);
            return res.status(500).json({ error: 'Falha na API Gemini', detalhes: data });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

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
