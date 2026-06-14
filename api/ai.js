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
    // Ou da variável de ambiente configurada no servidor
    const clientKey = req.headers['x-gemini-key'];
    let apiKey = clientKey || process.env.GEMINI_API_KEY;
    
    // Remove aspas caso o usuário tenha colado com aspas
    if (apiKey) {
        apiKey = apiKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }

    if (!apiKey || apiKey === 'undefined') {
        return res.status(401).json({ 
            error: 'Chave de API do Gemini não configurada.',
            message: 'Você precisa gerar sua própria chave de API gratuita do Gemini no Google AI Studio (https://aistudio.google.com/app/apikey) e configurá-la nas configurações do Sensei IA (ícone de engrenagem ⚙️).'
        });
    }

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
                parts: [{ text: "Você é o Sensei IA, um tutor de japonês para brasileiros. Responda de forma extremamente OBJETIVA, DIRETA e CURTA. Evite saudações longas, rodeios ou explicações prolixas. Se o usuário perguntar sobre uma palavra ou frase, dê a tradução, a leitura e explique a gramática essencial em no máximo 3 ou 4 tópicos curtos. Use Markdown para destacar partículas e termos importantes. Se o usuário pedir para adicionar, salvar ou guardar um ou mais termos, você DEVE chamar a função 'adicionarTermos'. Se o usuário pedir para remover, deletar ou excluir um ou mais termos do banco de dados ou vocabulário, você DEVE chamar a função 'removerTermos'. Analise com extrema atenção a classe gramatical do termo antes de classificar." }]
            },
            tools: [{
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
                                            item: { type: "STRING", description: "A palavra em japonês (kanji/kana)" },
                                            leitura: { type: "STRING", description: "A leitura em romaji ou kana" },
                                            significado: { type: "STRING", description: "A tradução em português" },
                                            categoria: { 
                                                type: "STRING", 
                                                description: "Classe gramatical correta do termo. Regras cruciais: " +
                                                             "1) Se for um verbo (termina em -u, -ru, -tsu, etc., ou em forma polida -masu, -te, -ta), deve ser categorizado como 'Verbo', NUNCA 'Vocabulário'. " +
                                                             "2) Se for uma partícula (は, が, を, に, で, etc.), deve ser 'Partícula'. " +
                                                             "3) Se for pronome/adjetivo demonstrativo (kono, sore, dore, etc.), deve ser 'Demonstrativo'. " +
                                                             "4) Se for um único Kanji isolado, deve ser 'Kanji'. " +
                                                             "5) Se for um substantivo, adjetivo, advérbio ou expressão comum, use 'Vocabulário'."
                                            },
                                            conjunto: { type: "STRING", description: "A pasta ou categoria personalizada onde ficará. Se o usuário não especificar explicitamente, envie 'Geral'." }
                                        },
                                        required: ["item", "leitura", "significado", "categoria", "conjunto"]
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
                                    description: "Lista das palavras em japonês (kanji/kana) a serem removidas.",
                                    items: {
                                        type: "STRING",
                                        description: "A palavra em japonês a ser removida"
                                    }
                                }
                            },
                            required: ["termos"]
                        }
                    }
                ]
            }],
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

        const part = data.candidates?.[0]?.content?.parts?.[0];
        
        if (part?.functionCall) {
            if (part.functionCall.name === "adicionarTermos") {
                return res.status(200).json({ 
                    reply: "Entendido! Estou adicionando ao seu banco de dados...",
                    action: 'add_terms',
                    terms: part.functionCall.args.termos
                });
            } else if (part.functionCall.name === "removerTermos") {
                return res.status(200).json({
                    reply: "Entendido! Estou removendo do seu banco de dados...",
                    action: 'remove_terms',
                    terms: part.functionCall.args.termos
                });
            }
        }

        const textResponse = part?.text || "Desculpe, não consegui formular uma resposta.";
        
        return res.status(200).json({ reply: textResponse });

    } catch (error) {
        console.error("Erro interno no backend da IA:", error);
        return res.status(500).json({ error: 'Erro no servidor.', message: error.message });
    }
}
