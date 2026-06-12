export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key');

    // Responde ao preflight do CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    // A chave pode vir do cabeçalho enviado pelo cliente (se ele configurar uma própria)
    // Ou da variável de ambiente (se o dono do servidor colocar lá na Vercel)
    const clientKey = req.headers['x-gemini-key'];
    let apiKey = clientKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(401).json({ error: 'Nenhuma chave de API fornecida. Configure no painel do Sensei IA.' });
    }

    // Remove aspas caso o usuário tenha colado com aspas
    apiKey = apiKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const messages = body.messages || [];

        if (!messages || messages.length === 0) {
            return res.status(400).json({ error: 'A lista de mensagens está vazia.' });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: messages,
            systemInstruction: {
                parts: [{ text: "Você é o Sensei IA, um tutor especializado no ensino da língua japonesa para brasileiros. Seu objetivo é analisar frases, explicar gramática (partículas, conjugações) e dar traduções com foco no contexto. Seja didático, amigável, direto ao ponto e use Markdown para destacar (negrito, itálico) partículas e termos importantes. Quando analisar uma frase, separe os termos para facilitar a leitura." }]
            },
            generationConfig: {
                temperature: 0.7
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erro da API Gemini:", data);
            
            // Tratamento especial para chave inválida
            if (response.status === 400 && data.error && data.error.message.includes("API key not valid")) {
                return res.status(401).json({ error: 'Sua Chave de API do Gemini é inválida. Por favor, verifique se copiou corretamente.', detalhes: data });
            }
            
            return res.status(response.status).json({ error: 'Falha ao conectar com o Gemini', detalhes: data });
        }

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui formular uma resposta.";
        
        return res.status(200).json({ reply: textResponse });

    } catch (error) {
        console.error("Erro interno no backend da IA:", error);
        return res.status(500).json({ error: 'Erro no servidor.', message: error.message });
    }
}
