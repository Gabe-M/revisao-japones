async function callAI(systemInstruction, messages, geminiKey, openAIKey, groqKey, provider = 'gemini', groqModel = 'llama-3.3-70b-versatile') {
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

    if (provider === 'groq') {
        if (!groqKey) {
            throw new Error("Chave de API do Groq não configurada.");
        }
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const payload = {
            model: groqModel,
            messages: [
                { role: "system", content: systemInstruction },
                ...messages
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        };

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || JSON.stringify(data));
        
        const content = data.choices?.[0]?.message?.content || "{}";
        return JSON.parse(content);
    }

    if (provider === 'pollinations') {
        const url = 'https://text.pollinations.ai/';
        
        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : msg.role,
            content: msg.content
        }));

        const payload = {
            messages: [
                { role: "system", content: systemInstruction },
                ...formattedMessages
            ],
            model: 'openai',
            jsonMode: true
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Pollinations API error: ${response.status} ${errText}`);
        }
        
        const text = await response.text();
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7, cleanText.length - 3).trim();
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3, cleanText.length - 3).trim();
        }
        return JSON.parse(cleanText);
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
    let groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') : null;

    const clientGeminiKey = req.headers['x-gemini-key'];
    const clientOpenAIKey = req.headers['x-openai-key'];
    const clientGroqKey = req.headers['x-groq-key'];

    if (clientGeminiKey) {
        const cleaned = clientGeminiKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (cleaned.startsWith('sk-')) {
            openAIKey = cleaned;
        } else if (cleaned.startsWith('gsk_')) {
            groqKey = cleaned;
        } else {
            geminiKey = cleaned;
        }
    }
    if (clientOpenAIKey) {
        const cleaned = clientOpenAIKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (cleaned.startsWith('gsk_')) {
            groqKey = cleaned;
        } else {
            openAIKey = cleaned;
        }
    }
    if (clientGroqKey) {
        groqKey = clientGroqKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { provider = 'gemini', acao, tema, jlpt, vocabulario, frase_jp, resposta_pt, historico, resposta_usuario_jp } = body;

        // Validação da chave correspondente ao provedor
        if (provider === 'gemini' && !geminiKey) {
            return res.status(401).json({ error: 'Chave de API do Gemini não configurada no .env' });
        }
        if (provider === 'openai' && !openAIKey) {
            return res.status(401).json({ error: 'Chave de API da OpenAI não configurada no .env' });
        }
        if (provider === 'groq' && !groqKey) {
            return res.status(401).json({ error: 'Chave de API do Groq (GROQ_API_KEY) não configurada no .env' });
        }

        let systemInstruction = "";
        let prompt = "";
        let result = {};

        switch (acao) {
            case 'gerar_guia':
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Use tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> nas frases (em 'exemplo_jp' e 'jp' de frases_uteis) sempre que usar Kanji. O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji) e deve ser colocado apenas sobre os Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. NÃO utilize de forma alguma tags <span> ou qualquer outra tag HTML além de <ruby> e <rt>.";
                prompt = `Gere um guia de estudos em japonês para o tema: "${tema}".
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                ${vocabulario && vocabulario.length > 0 ? `Palavras que devem ser priorizadas ou incluídas se possível: ${vocabulario.slice(0, 20).join(', ')}` : ''}
                
                Estrutura do JSON esperado:
                {
                    "regras": [
                        { "titulo": "Apresentação básica", "termo": "は", "leitura": "wa", "explicacao": "Usa-se a partícula は para marcar o tópico da frase.", "exemplo_jp": "<ruby>私<rt>わたし</rt></ruby>は<ruby>学生<rt>がくせい</rt></ruby>です", "exemplo_pt": "Eu sou estudante" }
                    ],
                    "vocabulario": [
                        { "item": "学生", "leitura": "がくせい", "significado": "Estudante", "jlpt": "N5" }
                    ],
                    "frases_uteis": [
                        { "jp": "<ruby>宜<rt>よろ</rt></ruby>しくお<ruby>願<rt>ねが</rt></ruby>いします", "pt": "Prazer em conhecê-lo / Conto com você" }
                    ]
                }
                Retorne no mínimo 3 regras, 8 vocabulários e 4 frases úteis.`;
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.3-70b-versatile');
                return res.status(200).json(result);

            case 'gerar_traducao':
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Em 'frase_jp', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby> (nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji) e deve ser colocado apenas sobre os Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. NÃO utilize de forma alguma tags <span> ou qualquer outra tag HTML além de <ruby> e <rt>. Restrinja o vocabulário e Kanjis ao solicitado pelo aluno.";
                
                let limitacoesVocab = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocab = `
                    IMPORTANTE: O aluno está utilizando um filtro de palavras aprendidas. 
                    Você DEVE obrigatoriamente criar a frase utilizando APENAS Kanjis e palavras que estejam presentes na seguinte lista: [${vocabulario.slice(0, 40).join(', ')}]. 
                    Para ligar os termos e formar a frase, use apenas partículas gramaticais básicas (は, が, に, を, で, の, と, も, へ, から, まで, ね, よ) e flexões verbais elementares (lesse/verbos como です, ます, だ, する, いる, ある, った, ない). 
                    NÃO introduza de forma alguma novos Kanjis ou palavras complexas que estejam fora dessa lista.`;
                }

                prompt = `Gere uma única frase natural em japonês sobre o tema: "${tema}".
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                ${limitacoesVocab}
                
                Estrutura do JSON esperado:
                {
                    "frase_jp": "frase gerada (com tags ruby)",
                    "frase_pt": "tradução exata da frase gerada",
                    "dica": "uma dica gramatical curta sobre a frase",
                    "explicacao": "Explicação detalhada em português sobre a estrutura gramatical e vocabulário da frase, ajudando o aluno a compreendê-la passo a passo."
                }`;
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
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
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            case 'iniciar_dialogo':
                let limitacoesVocabIni = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocabIni = `
                    ATENÇÃO CRÍTICA: O aluno está filtrando a conversa apenas para palavras que ele já aprendeu.
                    Você DEVE obrigatoriamente construir a sua fala em japonês (mensagem_ia_jp) utilizando APENAS Kanjis e palavras presentes nesta lista de vocabulário: [${vocabulario.slice(0, 40).join(', ')}]. 
                    Para formar a frase, use apenas partículas gramaticais básicas (ha, ga, ni, wo, de, no, etc.) e flexões verbais elementares.
                    NÃO utilize em hipótese alguma novos Kanjis ou palavras complexas que estejam fora dessa lista.`;
                }

                systemInstruction = `Você é um personagem em um RPG de conversa em japonês focado no tema: "${tema}". Inicie a conversa. Retorne APENAS um JSON. Importante: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> na mensagem_ia_jp para TODOS os Kanjis presentes (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby>, e não fora (ou seja, nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji), e deve ser aplicado apenas sobre Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. NÃO utilize de forma alguma tags <span> ou qualquer outra tag HTML além de <ruby> e <rt>.`;
                prompt = `Inicie a conversa do RPG.
                ${jlpt ? `Use gramática e vocabulário até o nível: ${jlpt}.` : ''}
                ${limitacoesVocabIni}
                
                Estrutura do JSON esperado:
                {
                    "mensagem_ia_jp": "Sua primeira fala em japonês (com ruby tags)",
                    "mensagem_ia_pt": "Tradução da sua fala",
                    "contexto": "Breve explicação do cenário em português (ex: Você entra na loja e o atendente diz:)"
                }`;
                
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.3-70b-versatile');
                return res.status(200).json(result);

            case 'continuar_dialogo':
                let limitacoesVocabCont = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocabCont = `
                    ATENÇÃO CRÍTICA: O aluno está filtrando a conversa apenas para palavras que ele já aprendeu.
                    Você DEVE obrigatoriamente construir a sua resposta em japonês (mensagem_ia_jp) utilizando APENAS Kanjis e palavras presentes nesta lista de vocabulário: [${vocabulario.slice(0, 40).join(', ')}]. 
                    Para formar a frase, use apenas partículas gramaticais básicas e flexões verbais básicas.
                    NÃO utilize em hipótese alguma novos Kanjis ou palavras complexas que estejam fora dessa lista.`;
                }

                systemInstruction = `Você é um personagem de RPG conversando em japonês e um professor que avalia. Avalie a última fala do aluno em português, e responda no personagem em japonês. Retorne APENAS um JSON. Importante: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> na mensagem_ia_jp para TODOS os Kanjis presentes (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby>, e não fora (ou seja, nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji), e deve ser aplicado apenas sobre Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. NÃO utilize de forma alguma tags <span> ou qualquer outra tag HTML além de <ruby> e <rt>.`;
                
                const msgs = historico.map(m => ({
                    role: m.role, // 'user' ou 'assistant'
                    content: m.content
                }));
                // A última mensagem deve ser a do usuário:
                msgs.push({
                    role: 'user',
                    content: `Minha resposta é: "${resposta_usuario_jp}". Analise e responda no personagem.
                    ${limitacoesVocabCont}`
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

                result = await callAI(systemInstruction, msgs, geminiKey, openAIKey, groqKey, provider, 'llama-3.3-70b-versatile');
                return res.status(200).json(result);

            case 'ajustar_nota':
                const fraseLimpa = body.fraseOriginal ? body.fraseOriginal.replace(/<[^>]*>/g, '') : '';
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido contendo a nova definição do termo. Importante: explique/traduza APENAS o termo fornecido (sua função gramatical, sentido ou tradução específica) dentro da frase em que ele aparece, e NÃO a tradução da frase inteira.";
                prompt = `Termo a ser explicado: "${body.termo}"
                Leitura/Furigana (se aplicável): "${body.leitura || ''}"
                Frase original de contexto: "${fraseLimpa || tema || ''}"
                
                Instruções:
                1. Analise o "Termo a ser explicado" no contexto da "Frase original de contexto".
                2. Explique o significado específico ou função que esse termo desempenha nessa frase.
                3. A explicação deve ser curta e direta, em português. Não forneça a tradução da frase inteira, apenas do termo.
                
                Estrutura do JSON esperado:
                {
                    "significado": "Significado curto ou função do termo de acordo com a frase"
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            default:
                return res.status(400).json({ error: 'Ação inválida' });
        }

    } catch (error) {
        console.error("Erro interno no api/dialogo:", error);
        return res.status(500).json({ error: 'Erro no servidor.', message: error.message });
    }
}
