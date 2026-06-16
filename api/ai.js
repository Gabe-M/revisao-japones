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

    // A chave pode vir dos cabeçalhos do cliente ou de variáveis de ambiente
    const clientKey = req.headers['x-openai-key'] || req.headers['x-gemini-key'];
    let apiKey = clientKey || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    
    // Remove aspas caso o usuário tenha colado com aspas
    if (apiKey) {
        apiKey = apiKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }

    if (!apiKey || apiKey === 'undefined') {
        return res.status(401).json({ 
            error: 'Chave de API da OpenAI não configurada.',
            message: 'Você precisa gerar sua própria chave de API da OpenAI (https://platform.openai.com/api-keys) e configurá-la nas configurações do Sensei IA (ícone de engrenagem ⚙️).'
        });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const messages = body.messages || [];

        // Limita o histórico às últimas 10 mensagens para economizar tokens
        const maxHistory = 10;
        const messagesToProcess = messages.slice(-maxHistory);

        // Converte o histórico no formato Gemini para OpenAI
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
            max_completion_tokens: 400 // Economia de tokens de saída
        };

        if (body.mode === 'json') {
            payload.messages = [
                { 
                    role: "system", 
                    content: "Você é um assistente especialista em japonês. Você deve obrigatoriamente retornar um JSON puro, sem formatação markdown (```json). Responda estritamente no formato JSON solicitado." 
                },
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
                                            item: { 
                                                type: "string", 
                                                description: "A palavra escrita em japonês original (Kanji se houver, ou Hiragana/Katakana, ex: '猫', '食べる', '車'). NUNCA preencha este campo com Romaji ou Português." 
                                            },
                                            leitura: { 
                                                type: "string", 
                                                description: "A leitura/pronúncia do termo em Romaji ou Hiragana/Katakana (ex: 'Neko', 'Taberu', 'Kuruma'). Se o usuário não forneceu a pronúncia, deduza você mesmo." 
                                            },
                                            significado: { 
                                                type: "string", 
                                                description: "O significado/tradução exata do termo em português (ex: 'Gato', 'Comer', 'Carro'). Se o usuário não forneceu a tradução, deduza você mesmo." 
                                            },
                                            categoria: { 
                                                type: "string", 
                                                description: "Classe gramatical correta do termo. Regras cruciais: " +
                                                             "1) Se for um verbo (termina em -u, -ru, -tsu, etc., ou em forma polida -masu, -te, -ta), deve ser categorizado como 'Verbo', NUNCA 'Vocabulário'. " +
                                                             "2) Se for uma partícula (は, が, を, に, de, etc.), deve ser 'Partícula'. " +
                                                             "3) Se for pronome/adjetivo demonstrativo (kono, sore, dore, etc.), deve ser 'Demonstrativo'. " +
                                                             "4) Se for um único Kanji isolado, deve ser 'Kanji'. " +
                                                             "5) Se for um substantivo, adjetivo, advérbio ou expressão comum, use 'Vocabulário'."
                                            },
                                            conjunto: { 
                                                type: "string", 
                                                description: "A pasta ou conjunto (categoria personalizada) onde o termo ficará. Se o usuário não especificar explicitamente na mensagem, preencha como 'Geral'." 
                                            },
                                            jlpt: {
                                                type: "string",
                                                description: "O nível JLPT mais apropriado para este termo (ex: 'N5', 'N4', 'N3', 'N2', 'N1'). Preencha sempre deduzindo pela complexidade da palavra."
                                            }
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
            console.error("Erro da API OpenAI:", data);
            const openAIErrorMsg = data?.error?.message || (typeof data === 'string' ? data : JSON.stringify(data));
            
            if (openAIErrorMsg.includes("Incorrect API key provided") || openAIErrorMsg.includes("invalid_api_key") || response.status === 401) {
                return res.status(401).json({ 
                    error: 'Sua Chave de API da OpenAI parece ser inválida ou não configurada corretamente.', 
                    message: `Sua Chave de API da OpenAI parece ser inválida ou não configurada corretamente. Detalhes da OpenAI: "${openAIErrorMsg}"`,
                    detalhes: data 
                });
            }
            
            return res.status(response.status || 500).json({ 
                error: 'Falha ao conectar com a OpenAI', 
                message: `Falha ao conectar com a OpenAI. Detalhes da API: "${openAIErrorMsg}"`,
                detalhes: data 
            });
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
                return res.status(200).json({ 
                    reply: "Entendido! Estou adicionando ao seu banco de dados...",
                    action: 'add_terms',
                    terms: args.termos
                });
            } else if (functionName === "removerTermos") {
                return res.status(200).json({
                    reply: "Entendido! Estou removendo do seu banco de dados...",
                    action: 'remove_terms',
                    terms: args.termos
                });
            }
        }

        const textResponse = message?.content || "Desculpe, não consegui formular uma resposta.";
        return res.status(200).json({ reply: textResponse });

    } catch (error) {
        console.error("Erro interno no backend da IA:", error);
        return res.status(500).json({ error: 'Erro no servidor.', message: error.message });
    }
}
