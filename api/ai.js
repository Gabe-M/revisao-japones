async function callGemini(messages, apiKey, body) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    
    let payload = {
        contents: messages,
        generationConfig: {
            temperature: 0.7
        }
    };

    if (body.mode === 'json') {
        payload.systemInstruction = {
            parts: [{ text: "Você é um assistente especialista em japonês. Você deve obrigatoriamente retornar um JSON puro, sem formatação markdown (```json). Responda estritamente no formato JSON solicitado." }]
        };
        payload.generationConfig.responseMimeType = "application/json";
    } else {
        payload.systemInstruction = {
            parts: [{ text: "Você é o Sensei IA, um tutor de japonês para brasileiros. Responda de forma extremamente OBJETIVA, DIRETA e CURTA. Evite saudações longas, rodeios ou explicações prolixas. Se o usuário perguntar sobre uma palavra ou frase, dê a tradução, a leitura e explique a gramática essencial in no máximo 3 ou 4 tópicos curtos. Use Markdown para destacar partículas e termos importantes. " +
                            "REGRA CRÍTICA DE SALVAR: Se o usuário pedir para adicionar, salvar, guardar ou registrar um ou mais termos/palavras no vocabulário/banco de dados (ex: 'adicione X', 'salve Y'), você DEVE obrigatoriamente chamar a função 'adicionarTermos'. Se o usuário não fornecer tradução, leitura ou categoria gramatical, você DEVE deduzir ou pesquisar em seu conhecimento de japonês para preenchê-los e chamar a função imediatamente. " +
                            "REGRA CRÍTICA DE REMOVER: Se o usuário pedir para remover, deletar, excluir ou apagar um ou mais termos (ex: 'delete X', 'remova Y'), você DEVE obrigatoriamente chamar a função 'removerTermos'. Converta o termo que o usuário deseja remover para a grafia correta em japonês (Kanji/Kana) para passar para a função." }]
        };
        payload.tools = [{
            functionDeclarations: [
                {
                    name: "adicionarTermos",
                    description: "Adiciona termos ou palavras ao banco de dados do usuário. Chame esta função APENAS quando o usuário pedir explicitamente para adicionar/salvar palavras.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            termos: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        item: { type: "STRING", description: "A palavra escrita em japonês original (Kanji se houver, ou Hiragana/Katakana, ex: '猫', '食べる', '車'). NUNCA preencha este campo com Romaji ou Português." },
                                        leitura: { type: "STRING", description: "A leitura/pronúncia do termo em Romaji ou Hiragana/Katakana (ex: 'Neko', 'Taberu', 'Kuruma'). Se o usuário não forneceu a pronúncia, deduza você mesmo." },
                                        significado: { type: "STRING", description: "O significado/tradução exata do termo em português (ex: 'Gato', 'Comer', 'Carro'). Se o usuário não forneceu a tradução, deduza você mesmo." },
                                        categoria: { 
                                            type: "STRING", 
                                            description: "Classe gramatical correta do termo. Regras cruciais: " +
                                                         "1) Se for um verbo (termina em -u, -ru, -tsu, etc., ou em forma polida -masu, -te, -ta), deve ser categorizado como 'Verbo', NUNCA 'Vocabulário'. " +
                                                         "2) Se for uma partícula (は, が, を, に, de, etc.), deve ser 'Partícula'. " +
                                                         "3) Se for pronome/adjetivo demonstrativo (kono, sore, dore, etc.), deve ser 'Demonstrativo'. " +
                                                         "4) Se for um único Kanji isolado, deve ser 'Kanji'. " +
                                                         "5) Se for um substantivo, adjetivo, advérbio ou expressão comum, use 'Vocabulário'."
                                        },
                                        conjunto: { type: "STRING", description: "A pasta ou conjunto (categoria personalizada) onde o termo ficará. Se o usuário não especificar explicitamente na mensagem, preencha como 'Geral'." },
                                        jlpt: { type: "STRING", description: "O nível JLPT mais apropriado para este termo (ex: 'N5', 'N4', 'N3', 'N2', 'N1'). Preencha sempre deduzindo pela complexidade da palavra." }
                                    },
                                    required: ["item", "leitura", "significado", "categoria", "conjunto", "jlpt"]
                                }
                            }
                        },
                        required: ["termos"]
                    }
                },
                {
                    name: "removerTermos",
                    description: "Remove um ou mais termos ou palavras do banco de dados do usuário. Chame esta função APENAS quando o usuário pedir explicitamente para remover, deletar ou excluir palavras.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            termos: {
                                type: "ARRAY",
                                description: "Lista das palavras escritas EM JAPONÊS (Kanji ou Hiragana/Katakana original, ex: '食べる', '私') a serem removidas. Se o usuário pedir para remover usando Romaji (ex: 'taberu') ou tradução (ex: 'comer'), você deve converter para a grafia japonesa correspondente antes de preencher a lista.",
                                items: {
                                    type: "STRING",
                                    description: "A palavra em japonês a ser removida (Kanji ou Hiragana/Katakana)"
                                }
                            }
                        },
                        required: ["termos"]
                    }
                }
            ]
        }];
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || JSON.stringify(data));
    }

    const part = data.candidates?.[0]?.content?.parts?.[0];
    if (part?.functionCall) {
        if (part.functionCall.name === "adicionarTermos") {
            return {
                reply: "Entendido! Estou adicionando ao seu banco de dados...",
                action: 'add_terms',
                terms: part.functionCall.args.termos
            };
        } else if (part.functionCall.name === "removerTermos") {
            return {
                reply: "Entendido! Estou removendo do seu banco de dados...",
                action: 'remove_terms',
                terms: part.functionCall.args.termos
            };
        }
    }

    return { reply: part?.text || "Desculpe, não consegui formular uma resposta." };
}

async function callOpenAI(messages, apiKey, body) {
    const maxHistory = 10;
    const messagesToProcess = messages.slice(-maxHistory);

    const openAIMessages = messagesToProcess.map(msg => {
        const role = msg.role === 'model' ? 'assistant' : msg.role;
        let content = '';
        if (msg.parts && msg.parts[0]) {
            content = msg.parts[0].text || '';
        } else if (typeof msg.content === 'string') {
            content = msg.content;
        }
        return { role, content };
    });

    let payload = {
        model: 'gpt-4o-mini',
        messages: [],
        temperature: 0.7,
        max_completion_tokens: 400
    };

    if (body.mode === 'json') {
        payload.messages = [
            { role: "system", content: "Você é um assistente especialista em japonês. Você deve obrigatoriamente retornar um JSON puro, sem formatação markdown (```json). Responda estritamente no formato JSON solicitado." },
            ...openAIMessages
        ];
        payload.response_format = { type: "json_object" };
    } else {
        payload.messages = [
            {
                role: "system",
                content: "Você é o Sensei IA, um tutor de japonês para brasileiros. Responda de forma extremamente OBJETIVA, DIRETA e CURTA. Evite saudações longas, rodeios ou explicações prolixas. Se o usuário perguntar sobre uma palavra ou frase, dê a tradução, a leitura e explique a gramática essencial em no máximo 3 ou 4 tópicos curtos. Use Markdown para destacar partículas e termos importantes. " +
                        "REGRA CRÍTICA DE SALVAR: Se o usuário pedir para adicionar, salvar, guardar ou registrar um ou mais termos/palavras no vocabulário/banco de dados (ex: 'adicione X', 'salve Y'), você DEVE obrigatoriamente chamar a função 'adicionarTermos'. Se o usuário não fornecer tradução, leitura ou categoria gramatical, você DEVE deduzir ou pesquisar em seu conhecimento de japonês para preenchê-los e chamar a função imediatamente. " +
                        "REGRA CRÍTICA DE REMOVER: Se o usuário pedir para remover, deletar, excluir ou apagar um ou mais termos (ex: 'delete X', 'remova Y'), você DEVE obrigatoriamente chamar a função 'removerTermos'. Converta o termo que o usuário deseja remover para a grafia correta em japonês (Kanji/Kana) para passar para a função."
            },
            ...openAIMessages
        ];

        payload.tools = [
            {
                type: "function",
                function: {
                    name: "adicionarTermos",
                    description: "Adiciona termos ou palavras ao banco de dados do usuário. Chame esta função APENAS quando o usuário pedir explicitamente para adicionar/salvar palavras.",
                    parameters: {
                        type: "object",
                        properties: {
                            termos: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        item: { type: "string", description: "A palavra escrita em japonês original (Kanji se houver, ou Hiragana/Katakana, ex: '猫', '食べる', '車'). NUNCA preencha este campo com Romaji ou Português." },
                                        leitura: { type: "string", description: "A leitura/pronúncia do termo em Romaji ou Hiragana/Katakana (ex: 'Neko', 'Taberu', 'Kuruma'). Se o usuário não forneceu a pronúncia, deduza você mesmo." },
                                        significado: { type: "string", description: "O significado/tradução exata do termo em português (ex: 'Gato', 'Comer', 'Carro'). Se o usuário não forneceu a tradução, deduza você mesmo." },
                                        categoria: {
                                            type: "string",
                                            description: "Classe gramatical correta do termo. Regras cruciais: " +
                                                         "1) Se for um verbo (termina em -u, -ru, -tsu, etc., ou em forma polida -masu, -te, -ta), deve ser categorizado como 'Verbo', NUNCA 'Vocabulário'. " +
                                                         "2) Se for uma partícula (は, が, を, に, de, etc.), deve ser 'Partícula'. " +
                                                         "3) Se for pronome/adjetivo demonstrativo (kono, sore, dore, etc.), deve ser 'Demonstrativo'. " +
                                                         "4) Se for um único Kanji isolado, deve ser 'Kanji'. " +
                                                         "5) Se for um substantivo, adjetivo, advérbio ou expressão comum, use 'Vocabulário'."
                                        },
                                        conjunto: { type: "string", description: "A pasta ou conjunto (categoria personalizada) onde o termo ficará. Se o usuário não especificar explicitamente na mensagem, preencha como 'Geral'." },
                                        jlpt: { type: "string", description: "O nível JLPT mais apropriado para este termo (ex: 'N5', 'N4', 'N3', 'N2', 'N1'). Preencha sempre deduzindo pela complexidade da palavra." }
                                    },
                                    required: ["item", "leitura", "significado", "categoria", "conjunto", "jlpt"]
                                }
                            }
                        },
                        required: ["termos"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "removerTermos",
                    description: "Remove um ou mais termos ou palavras do banco de dados do usuário. Chame esta função APENAS quando o usuário pedir explicitamente para remover, deletar ou excluir palavras.",
                    parameters: {
                        type: "object",
                        properties: {
                            termos: {
                                type: "array",
                                description: "Lista das palavras escritas EM JAPONÊS (Kanji ou Hiragana/Katakana original, ex: '食べる', '私') a serem removidas. Se o usuário pedir para remover usando Romaji (ex: 'taberu') ou tradução (ex: 'comer'), você deve converter para a grafia japonesa correspondente antes de preencher a lista.",
                                items: {
                                    type: "string",
                                    description: "A palavra em japonês a ser removida (Kanji ou Hiragana/Katakana)"
                                }
                            }
                        },
                        required: ["termos"]
                    }
                }
            }
        ];
    }

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

    const choice = data.choices?.[0];
    const message = choice?.message;

    if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const functionName = toolCall.function?.name;
        let args = {};
        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            console.error("Erro ao processar argumentos da OpenAI:", e);
        }

        if (functionName === "adicionarTermos") {
            return { 
                reply: "Entendido! Estou adicionando ao seu banco de dados...",
                action: 'add_terms',
                terms: args.termos
            };
        } else if (functionName === "removerTermos") {
            return {
                reply: "Entendido! Estou removendo do seu banco de dados...",
                action: 'remove_terms',
                terms: args.termos
            };
        }
    }

    return { reply: message?.content || "Desculpe, não consegui formular uma resposta." };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key, X-OpenAI-Key');

    // Responde ao preflight do CORS
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
        return res.status(401).json({ 
            error: 'Nenhuma chave de API configurada.',
            message: 'Você precisa configurar uma chave de API (Gemini ou OpenAI) nas configurações do Sensei IA (ícone de engrenagem ⚙️).'
        });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const messages = body.messages || [];

        if (!messages || messages.length === 0) {
            return res.status(400).json({ error: 'A lista de mensagens está vazia.' });
        }

        // Tenta primeiro o Gemini
        if (geminiKey) {
            try {
                console.log("[AI] Tentando responder usando Gemini...");
                const result = await callGemini(messages, geminiKey, body);
                return res.status(200).json(result);
            } catch (geminiError) {
                console.warn("[AI] Gemini falhou com erro:", geminiError.message);
                
                // Se OpenAI estiver disponível, faz o fallback
                if (openAIKey) {
                    try {
                        console.log("[AI] Fazendo fallback para OpenAI...");
                        const result = await callOpenAI(messages, openAIKey, body);
                        return res.status(200).json(result);
                    } catch (openAIError) {
                        console.error("[AI] Ambos provedores falharam. Erro OpenAI:", openAIError.message);
                        return res.status(500).json({ 
                            error: 'Ambos os provedores de IA falharam.', 
                            message: `Gemini erro: "${geminiError.message}". OpenAI erro: "${openAIError.message}"` 
                        });
                    }
                } else {
                    return res.status(500).json({ 
                        error: 'Gemini falhou e nenhum fallback OpenAI está configurado.', 
                        message: geminiError.message 
                    });
                }
            }
        }

        // Se só houver OpenAI configurado
        if (openAIKey) {
            try {
                console.log("[AI] Usando OpenAI diretamente...");
                const result = await callOpenAI(messages, openAIKey, body);
                return res.status(200).json(result);
            } catch (openAIError) {
                console.error("[AI] OpenAI falhou com erro:", openAIError.message);
                return res.status(500).json({ 
                    error: 'OpenAI falhou.', 
                    message: openAIError.message 
                });
            }
        }

    } catch (error) {
        console.error("Erro interno no backend da IA:", error);
        return res.status(500).json({ error: 'Erro no servidor.', message: error.message });
    }
}
