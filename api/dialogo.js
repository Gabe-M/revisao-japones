async function callAI(systemInstruction, messages, geminiKey, openAIKey, provider = 'gemini') {
    const isJson = true; // Sempre esperamos JSON no diálogo

    if (provider === 'gemini') {
        if (!geminiKey) {
            throw new Error("Chave de API do Gemini não configurada.");
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`;
        
        // Format messages for Gemini
        const geminiMessages = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const payload = {
            contents: geminiMessages,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json"
            }
        };
        
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || JSON.stringify(data));
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        return JSON.parse(text);
    }

    if (provider === 'openai') {
        if (!openAIKey) {
            throw new Error("Chave de API da OpenAI não configurada.");
        }
        const url = 'https://api.openai.com/v1/chat/completions';
        const payload = {
            model: 'gpt-4o-mini',
            messages: [
                { role: "system", content: systemInstruction },
                ...messages
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        };

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAIKey}` }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || JSON.stringify(data));
        
        const content = data.choices?.[0]?.message?.content || "{}";
        return JSON.parse(content);
    }
    
    throw new Error(`Provedor de IA inválido: ${provider}`);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key, X-OpenAI-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    let geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') : null;
    let openAIKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') : null;

    const clientGeminiKey = req.headers['x-gemini-key'];
    const clientOpenAIKey = req.headers['x-openai-key'];

    if (clientGeminiKey) {
        const cleaned = clientGeminiKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (cleaned.startsWith('sk-')) {
            openAIKey = cleaned;
        } else {
            geminiKey = cleaned;
        }
    }
    if (clientOpenAIKey) {
        const cleaned = clientOpenAIKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        openAIKey = cleaned;
    }

    if (!geminiKey && !openAIKey) {
        return res.status(401).json({ error: 'Nenhuma chave de API configurada.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { provider = 'gemini', acao, tema, jlpt, vocabulario, frase_jp, resposta_pt, historico, resposta_usuario_jp } = body;

        let systemInstruction = "";
        let prompt = "";
        let result = {};

        switch (acao) {
            case 'gerar_guia':
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Use tags HTML <ruby>Kanji<rt>furigana</rt></ruby> nas frases (em 'exemplo_jp' e 'jp' de frases_uteis) sempre que usar Kanji.";
                prompt = `Gere um guia de estudos em japonês para o tema: "${tema}".
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                ${vocabulario && vocabulario.length > 0 ? `Palavras que devem ser priorizadas ou incluídas se possível: ${vocabulario.slice(0, 20).join(', ')}` : ''}
                
                Estrutura do JSON esperado:
                {
                    "regras": [
                        { "titulo": "Apresentação básica", "explicacao": "Usa-se X para dizer Y", "exemplo_jp": "<ruby>私<rt>わたし</rt></ruby>は<ruby>学生<rt>がくせい</rt></ruby>です", "exemplo_pt": "Eu sou estudante" }
                    ],
                    "vocabulario": [
                        { "item": "学生", "leitura": "がくせい", "significado": "Estudante", "jlpt": "N5" }
                    ],
                    "frases_uteis": [
                        { "jp": "<ruby>宜<rt>よろ</rt></ruby>しくお<ruby>願<rt>ねが</rt></ruby>いします", "pt": "Prazer em conhecê-lo / Conto com você" }
                    ]
                }
                Retorne no mínimo 3 regras, 8 vocabulários e 4 frases úteis.`;
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, provider);
                return res.status(200).json(result);

            case 'gerar_traducao':
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Em 'frase_jp', use tags HTML <ruby>Kanji<rt>furigana</rt></ruby> se usar Kanjis.";
                prompt = `Gere uma única frase natural em japonês sobre o tema: "${tema}".
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                
                Estrutura do JSON esperado:
                {
                    "frase_jp": "frase gerada (com tags ruby)",
                    "frase_pt": "tradução exata da frase gerada",
                    "dica": "uma dica gramatical curta sobre a frase"
                }`;
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, provider);
                return res.status(200).json(result);

            case 'analisar_traducao':
                systemInstruction = "Você é um professor de japonês avaliando uma tradução. Retorne APENAS um JSON válido. O feedback (dica e erro) DEVE estar em Português.";
                prompt = `Frase original: "${frase_jp}"
                Tradução do aluno: "${resposta_pt}"
                
                Estrutura do JSON esperado:
                {
                    "score": 85, // número de 0 a 100
                    "correto": true, // true se o sentido principal passou, false se errou feito
                    "erros": ["O aluno esqueceu de traduzir a palavra X"], // array de strings
                    "dica": "A partícula に aqui indica direção.",
                    "traducao_correta": "Tradução ideal"
                }`;
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, provider);
                return res.status(200).json(result);

            case 'iniciar_dialogo':
                systemInstruction = `Você é um personagem em um RPG de conversa em japonês focado no tema: "${tema}". Inicie a conversa. Retorne APENAS um JSON. Use tags HTML <ruby>Kanji<rt>furigana</rt></ruby> na mensagem_ia_jp sempre que usar Kanji.`;
                prompt = `
                ${jlpt ? `Use gramática e vocabulário até o nível: ${jlpt}.` : ''}
                ${vocabulario && vocabulario.length > 0 ? `Palavras úteis disponíveis: ${vocabulario.slice(0, 20).join(', ')}` : ''}
                
                Estrutura do JSON esperado:
                {
                    "mensagem_ia_jp": "Sua primeira fala em japonês (com ruby tags)",
                    "mensagem_ia_pt": "Tradução da sua fala",
                    "contexto": "Breve explicação do cenário em português (ex: Você entra na loja e o atendente diz:)"
                }`;
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, provider);
                return res.status(200).json(result);

            case 'continuar_dialogo':
                systemInstruction = "Você é um personagem de RPG conversando em japonês e um professor que avalia. Avalie a última fala do aluno em português, e responda no personagem em japonês. Retorne APENAS um JSON.";
                
                const msgs = historico.map(m => ({
                    role: m.role, // 'user' ou 'assistant'
                    content: m.content
                }));
                // A última mensagem deve ser a do usuário:
                msgs.push({
                    role: 'user',
                    content: `Minha resposta é: "${resposta_usuario_jp}". Analise e responda no personagem.`
                });
                
                msgs.unshift({
                    role: 'user',
                    content: `Estrutura JSON Esperada na resposta:
                    {
                        "analise": "O que o aluno acertou/errou na frase dele (em português)",
                        "score": 90, // de 0 a 100
                        "mensagem_ia_jp": "Sua resposta no personagem em japonês",
                        "mensagem_ia_pt": "Tradução da sua resposta"
                    }`
                });

                result = await callAI(systemInstruction, msgs, geminiKey, openAIKey, provider);
                return res.status(200).json(result);

            default:
                return res.status(400).json({ error: 'Ação inválida' });
        }

    } catch (error) {
        console.error("Erro interno no api/dialogo:", error);
        return res.status(500).json({ error: 'Erro no servidor.', message: error.message });
    }
}
