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

function selectContextualVocab(vocabList, tema, historico, resposta_usuario_jp, limit = 50) {
    if (!Array.isArray(vocabList) || vocabList.length === 0) {
        return [];
    }

    const normalized = vocabList.map(v => {
        if (!v) return { item: '', significado: '', leitura: '' };
        if (typeof v === 'string') {
            return { item: v, significado: '', leitura: '' };
        }
        return {
            item: v.item || '',
            significado: v.significado || '',
            leitura: v.leitura || ''
        };
    });

    const topicoStr = tema || '';
    
    let lastMsgPt = '';
    let lastMsgJp = '';
    
    if (Array.isArray(historico) && historico.length > 0) {
        const lastMsg = historico[historico.length - 1];
        if (lastMsg) {
            lastMsgPt = (lastMsg.pt || lastMsg.analise || '').toString();
            lastMsgJp = (lastMsg.jp || lastMsg.content || '').toString();
        }
    }

    const portugueseContext = `${topicoStr} ${lastMsgPt}`.trim();
    const japaneseContext = `${resposta_usuario_jp || ''} ${lastMsgJp}`.trim();

    const cleanText = (str) => {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, ' ');
    };

    const cleanPtContext = cleanText(portugueseContext);
    const ptContextWords = cleanPtContext.split(/\s+/).filter(w => w.length > 1);

    const cleanJpContext = cleanText(japaneseContext);

    const scored = normalized.map((v, index) => {
        let score = 0;

        if (v.item && cleanJpContext.includes(v.item.toLowerCase())) {
            score += 30;
        } else if (v.item) {
            // Check for kanji matching (handles verb conjugations like 食べる -> 食べます)
            const kanjis = v.item.match(/[\u4e00-\u9faf]/g);
            if (kanjis && kanjis.length > 0) {
                const hasKanjiMatch = kanjis.some(k => cleanJpContext.includes(k));
                if (hasKanjiMatch) {
                    score += 20;
                }
            }
        }
        if (v.leitura && cleanJpContext.includes(v.leitura.toLowerCase())) {
            score += 20;
        }

        if (v.significado) {
            const cleanSig = cleanText(v.significado);
            
            if (cleanPtContext.includes(cleanSig)) {
                score += 25;
            }

            const sigWords = cleanSig.split(/\s+/).filter(w => w.length > 1);
            let overlaps = 0;
            sigWords.forEach(w => {
                if (ptContextWords.includes(w)) {
                    overlaps++;
                }
            });
            score += overlaps * 10;
        }

        score -= index * 0.0001;

        return { item: v.item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.item).filter(Boolean);
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://sodqxkvkxifczfscbxwo.supabase.co";
const SUPABASE_KEY = "sb_publishable_qanav-1ayeNA40f692w2Xg_qqGnFcuG";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function obterUserIdDoToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            console.error("Erro ao validar token com Supabase:", error);
            return null;
        }
        return user.id;
    } catch (e) {
        console.error("Exceção ao decodificar/validar token:", e);
        return null;
    }
}

function cleanFuriganaHtml(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]*>/g, '');
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key, X-OpenAI-Key, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const tokenUsuario = req.headers['authorization'];
    let userId = null;
    if (tokenUsuario) {
        userId = await obterUserIdDoToken(tokenUsuario);
    }

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
        const { provider = 'gemini', acao, tema, jlpt, vocabulario, frase_jp, resposta_pt, historico, resposta_usuario_jp, sessionId } = body;

        const precisaAuth = ['listar_sessoes', 'criar_sessao'].includes(acao) || !!sessionId;
        if (precisaAuth && !userId) {
            return res.status(401).json({ error: 'Não autorizado. Token de autenticação ausente ou inválido.' });
        }

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
            case 'listar_sessoes':
                try {
                    const response = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?select=id,nome,config,created_at&order=created_at.desc`, {
                        headers: {
                            "apikey": SUPABASE_KEY,
                            "Authorization": tokenUsuario
                        }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || JSON.stringify(data));
                    return res.status(200).json(data);
                } catch (err) {
                    console.error("Erro ao listar sessões:", err);
                    return res.status(500).json({ error: "Erro ao listar sessões", message: err.message });
                }

            case 'criar_sessao':
                try {
                    const { nome: nomeSessao, config } = body;
                    const payload = {
                        user_id: userId,
                        nome: nomeSessao || config?.tema || 'Nova Sessão',
                        config: config || {},
                        historico: [],
                        guia_dados: null,
                        contexto: null
                    };
                    const response = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes`, {
                        method: 'POST',
                        headers: {
                            "apikey": SUPABASE_KEY,
                            "Authorization": tokenUsuario,
                            "Content-Type": "application/json",
                            "Prefer": "return=representation"
                        },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || JSON.stringify(data));
                    return res.status(201).json(Array.isArray(data) ? data[0] : data);
                } catch (err) {
                    console.error("Erro ao criar sessão:", err);
                    return res.status(500).json({ error: "Erro ao criar sessão", message: err.message });
                }

            case 'gerar_guia':
                if (sessionId) {
                    try {
                        const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}&select=guia_dados`, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario
                            }
                        });
                        const resData = await responseGet.json();
                        if (responseGet.ok && resData && resData[0] && resData[0].guia_dados) {
                            return res.status(200).json(resData[0].guia_dados);
                        }
                    } catch (e) {
                        console.error("Erro ao recuperar guia_dados do banco:", e);
                    }
                }

                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Use tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> nas frases (em 'exemplo_jp' e 'jp' de frases_uteis) sempre que usar Kanji. O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji) e deve ser colocado apenas sobre os Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. NÃO utilize de forma alguma tags <span> ou qualquer outra tag HTML além de <ruby> e <rt>.";
                prompt = `Gere um guia de estudos em japonês para o tema: "${tema}".
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                ${vocabulario && vocabulario.length > 0 ? `Palavras que devem ser priorizadas ou incluídas se possível: ${selectContextualVocab(vocabulario, tema, null, null, 20).join(', ')}` : ''}
                
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
                
                if (sessionId && result && !result.error) {
                    try {
                        await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                            method: 'PATCH',
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ guia_dados: result })
                        });
                    } catch (e) {
                        console.error("Erro ao salvar guia_dados no banco:", e);
                    }
                }
                return res.status(200).json(result);

            case 'gerar_traducao':
                const novaFrase = body.novaFrase === true || body.forceNew === true || body.ignorar_cache === true;
                if (sessionId && !novaFrase) {
                    try {
                        const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}&select=traducao_dados`, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario
                            }
                        });
                        const resData = await responseGet.json();
                        if (responseGet.ok && resData && resData[0] && resData[0].traducao_dados && resData[0].traducao_dados.frase_jp) {
                            return res.status(200).json(resData[0].traducao_dados);
                        }
                    } catch (e) {
                        console.error("Erro ao carregar traducao_dados do banco:", e);
                    }
                }

                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Em 'frase_jp', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby> (nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji) e deve ser colocado apenas sobre os Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. NÃO utilize de forma alguma tags <span> ou qualquer outra tag HTML além de <ruby> e <rt>. Restrinja o vocabulário e Kanjis ao solicitado pelo aluno.";
                
                let limitacoesVocab = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocab = `
                    IMPORTANTE: O aluno está utilizando um filtro de palavras aprendidas. 
                    Você DEVE obrigatoriamente criar a frase utilizando APENAS Kanjis e palavras que estejam presentes na seguinte lista: [${selectContextualVocab(vocabulario, tema, null, null, 40).join(', ')}]. 
                    Para ligar os termos e formar a frase, use apenas partículas gramaticais básicas (は, が, に, を, de, の, と, も, へ, から, até, ne, yo) e flexões verbais elementares (como です, ます, da, する, em, ao, った, não). 
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
                
                if (sessionId && result && !result.error) {
                    try {
                        await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                            method: 'PATCH',
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                traducao_dados: result
                            })
                        });
                    } catch (e) {
                        console.error("Erro ao salvar traducao_dados no banco:", e);
                    }
                }
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

                if (sessionId && result && !result.error) {
                    try {
                        const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}&select=traducao_dados`, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario
                            }
                        });
                        const resData = await responseGet.json();
                        const currentData = (responseGet.ok && resData && resData[0]) ? resData[0].traducao_dados : {};
                        
                        const updatedData = {
                            ...currentData,
                            resposta_aluno: resposta_pt,
                            analise: result
                        };

                        await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                            method: 'PATCH',
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                traducao_dados: updatedData
                            })
                        });
                    } catch (e) {
                        console.error("Erro ao atualizar traducao_dados com a analise:", e);
                    }
                }
                return res.status(200).json(result);

            case 'salvar_traducao_dados':
                if (sessionId) {
                    try {
                        await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                            method: 'PATCH',
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                traducao_dados: body.traducao_dados
                            })
                        });
                        return res.status(200).json({ success: true });
                    } catch (e) {
                        console.error("Erro ao salvar traducao_dados:", e);
                        return res.status(500).json({ error: e.message });
                    }
                }
                return res.status(400).json({ error: "Sessão inválida" });

            case 'iniciar_dialogo':
                if (sessionId) {
                    try {
                        const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}&select=historico,contexto`, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario
                            }
                        });
                        const resData = await responseGet.json();
                        if (responseGet.ok && resData && resData[0] && Array.isArray(resData[0].historico) && resData[0].historico.length > 0) {
                            const firstMsg = resData[0].historico[0];
                            return res.status(200).json({
                                contexto: resData[0].contexto,
                                mensagem_ia_jp: firstMsg.jp || firstMsg.content,
                                mensagem_ia_pt: firstMsg.pt,
                                historico: resData[0].historico
                            });
                        }
                    } catch (e) {
                        console.error("Erro ao recuperar historico/contexto do banco:", e);
                    }
                }

                let limitacoesVocabIni = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocabIni = `
                    ATENÇÃO CRÍTICA: O aluno está filtrando a conversa apenas para palavras que ele já aprendeu.
                    Você DEVE obrigatoriamente construir a sua fala em japonês (mensagem_ia_jp) utilizando APENAS Kanjis e palavras presentes nesta lista de vocabulário: [${selectContextualVocab(vocabulario, tema, null, null, 50).join(', ')}]. 
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

                if (sessionId && result && !result.error) {
                    try {
                        const firstMsg = {
                            role: 'assistant',
                            jp: result.mensagem_ia_jp,
                            pt: result.mensagem_ia_pt,
                            content: result.mensagem_ia_jp
                        };
                        await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                            method: 'PATCH',
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                contexto: result.contexto,
                                historico: [firstMsg]
                            })
                        });
                    } catch (e) {
                        console.error("Erro ao salvar primeiro contato no banco:", e);
                    }
                }
                return res.status(200).json(result);

            case 'continuar_dialogo':
                let activeHistory = historico || [];
                if (sessionId) {
                    try {
                        const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}&select=historico`, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario
                            }
                        });
                        const resData = await responseGet.json();
                        if (responseGet.ok && resData && resData[0] && Array.isArray(resData[0].historico)) {
                            activeHistory = resData[0].historico;
                        }
                    } catch (e) {
                        console.error("Erro ao recuperar historico para continuar diálogo:", e);
                    }
                }

                // Garante que a última mensagem do usuário está no activeHistory
                const userMsgText = resposta_usuario_jp || '';
                const userMsgObj = { role: 'user', content: userMsgText, jp: userMsgText };
                const lastMsg = activeHistory[activeHistory.length - 1];
                if (!lastMsg || lastMsg.role !== 'user' || lastMsg.jp !== userMsgText) {
                    activeHistory.push(userMsgObj);
                }

                const hasTruncated = activeHistory && activeHistory.length > 6;
                const historicoFiltrado = hasTruncated ? activeHistory.slice(-6) : (activeHistory || []);
                const memoriaPrevia = hasTruncated ? `Contexto do RPG: A conversa atual é uma continuação do cenário definido pelo tópico '${tema}'. Mantenha a coerência com as interações anteriores.` : '';

                let limitacoesVocabCont = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocabCont = `
                    ATENÇÃO CRÍTICA: O aluno está filtrando a conversa apenas para palavras que ele já aprendeu.
                    Você DEVE obrigatoriamente construir a sua resposta em japonês (mensagem_ia_jp) utilizando APENAS Kanjis e palavras presentes nesta lista de vocabulário: [${selectContextualVocab(vocabulario, tema, historicoFiltrado, resposta_usuario_jp, 50).join(', ')}]. 
                    Para formar a frase, use apenas partículas gramaticais básicas e flexões verbais básicas.
                    NÃO utilize em hipótese alguma novos Kanjis ou palavras complexas que estejam fora dessa lista.`;
                }

                systemInstruction = `Você é um personagem de RPG conversando em japonês e um professor que avalia. Avalie a última fala do aluno em português, e responda no personagem em japonês. Retorne APENAS um JSON. Importante: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> na mensagem_ia_jp para TODOS os Kanjis presentes (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby>, e não fora (ou seja, nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji), e deve ser aplicado apenas sobre Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. NÃO utilize de forma alguma tags <span> ou qualquer outra tag HTML além de <ruby> e <rt>.`;
                if (memoriaPrevia) {
                    systemInstruction += `\n\n${memoriaPrevia}`;
                }
                
                const msgs = historicoFiltrado.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: cleanFuriganaHtml(m.content || m.jp || '')
                }));

                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') {
                    msgs.pop();
                }

                // A última mensagem deve ser a do usuário:
                msgs.push({
                    role: 'user',
                    content: `Minha resposta é: "${cleanFuriganaHtml(resposta_usuario_jp)}". Analise e responda no personagem.
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

                // Atualiza o item do usuário correspondente no activeHistory
                const userIdx = activeHistory.findIndex(m => m.role === 'user' && m.jp === userMsgText && m.analise === undefined);
                if (userIdx !== -1) {
                    activeHistory[userIdx].analise = result.analise;
                    activeHistory[userIdx].score = result.score;
                } else {
                    activeHistory[activeHistory.length - 1].analise = result.analise;
                    activeHistory[activeHistory.length - 1].score = result.score;
                }

                // Adiciona a resposta da IA no activeHistory
                const assistantMsgObj = {
                    role: 'assistant',
                    jp: result.mensagem_ia_jp,
                    pt: result.mensagem_ia_pt,
                    content: result.mensagem_ia_jp
                };
                activeHistory.push(assistantMsgObj);

                // Salva o histórico atualizado
                if (sessionId) {
                    try {
                        await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                            method: 'PATCH',
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                historico: activeHistory
                            })
                        });
                    } catch (e) {
                        console.error("Erro ao salvar histórico atualizado no banco:", e);
                    }
                }

                return res.status(200).json({
                    ...result,
                    historico: activeHistory
                });

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

            case 'analisar_mensagem':
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Identifique o vocabulário chave na mensagem.";
                prompt = `Mensagem: "${body.mensagem_ia_jp}"
                Tema: "${tema}"
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                
                Estrutura do JSON esperado:
                {
                    "vocabulario": [
                        { "item": "Kanji ou palavra", "leitura": "furigana/leitura", "significado": "Significado em português", "tipo": "Substantivo/Verbo/etc" }
                    ]
                }
                Retorne no máximo 10 itens importantes.`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            case 'sugerir_resposta':
                let limitacoesVocabSugestao = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocabSugestao = `
                    IMPORTANTE: O aluno está utilizando um filtro de palavras aprendidas. 
                    Você DEVE obrigatoriamente criar a frase utilizando APENAS Kanjis e palavras que estejam presentes na seguinte lista: [${selectContextualVocab(vocabulario, tema, null, body.mensagem_ia_jp, 40).join(', ')}]. 
                    Para ligar os termos e formar a frase, use apenas partículas gramaticais básicas e flexões verbais elementares. 
                    NÃO introduza de forma alguma novos Kanjis ou palavras complexas que estejam fora dessa lista.`;
                }
                systemInstruction = `Você é um personagem em um RPG de conversa em japonês focado no tema: "${tema}" e também um professor ajudando o aluno. Retorne APENAS um JSON válido. IMPORTANTE: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> na propriedade 'sugestao_jp' para TODOS os Kanjis presentes (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby>. O furigana deve ser escrito exclusivamente em Hiragana e aplicado apenas sobre Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. Não utilize nenhuma outra tag além de <ruby> e <rt>.`;
                prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
                Tema do RPG: "${tema}"
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                ${limitacoesVocabSugestao}
                
                Estrutura do JSON esperado:
                {
                    "sugestao_jp": "Sugestão de resposta do aluno em japonês (com ruby tags)",
                    "sugestao_pt": "Tradução exata da sugestão",
                    "dica": "Explicação curta do motivo dessa ser uma boa resposta"
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            case 'tirar_duvida':
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Esclareça a dúvida do aluno de forma clara, didática e em português.";
                prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
                Dúvida do aluno: "${body.duvida_usuario}"
                Tema do RPG: "${tema}"
                
                Estrutura do JSON esperado:
                {
                    "resposta": "Sua explicação detalhada esclarecendo a dúvida do aluno sobre a frase, o vocabulário, ou o contexto."
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            case 'analisar_pratica':
                systemInstruction = "Você é um professor de japonês avaliando a resposta do aluno no contexto de um diálogo. Retorne APENAS um JSON válido. O feedback (dica e erro) DEVE estar em Português. IMPORTANTE: Na propriedade 'traducao_correta', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e deve ser colocado apenas sobre os Kanjis, nunca sobre hiragana ou katakana puro. Não utilize nenhuma outra tag além de <ruby> e <rt>.";
                prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
                Resposta do aluno: "${body.resposta_usuario_jp}"
                
                Avalie se a resposta do aluno faz sentido no contexto da conversa e se a gramática/vocabulário estão corretos.
                Estrutura do JSON esperado:
                {
                    "score": 85, // número de 0 a 100
                    "correto": true, // true se for uma resposta aceitável e compreensível, false caso contrário
                    "erros": ["O aluno usou a partícula errada em X"], // array de strings com erros identificados (vazio se não houver)
                    "dica": "Dica de como soar mais natural ou corrigir o erro.",
                    "traducao_correta": "Sugestão de como o aluno poderia ter formulado essa mesma ideia de forma correta e natural em japonês"
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            case 'sugerir_lacuna':
                systemInstruction = "Você é um assistente de japonês. Retorne APENAS um JSON válido. O utilizador está tentando escrever uma frase em japonês mas não sabe uma palavra. Analise a 'frase_contexto' e sugira até 3 opções em japonês que traduzam o 'termo_pt' e se encaixem perfeitamente na gramática daquela frase específica. IMPORTANTE: Na propriedade 'termo_jp', use obrigatoriamente tags HTML no formato <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes (sem exceção). O furigana deve estar em Hiragana.";
                prompt = `Frase de contexto: "${body.frase_contexto}"
                Termo em português a traduzir/preencher: "${body.termo_pt}"
                
                Estrutura do JSON esperado:
                {
                    "sugestoes": [
                        {
                            "termo_jp": "<ruby>林檎<rt>りんご</rt></ruby>",
                            "texto_puro": "りんご",
                            "explicacao_curta": "Termo geral para maçã."
                        }
                    ]
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            case 'explicar_termo_contextual':
                systemInstruction = "Atue como um dicionário contextual de japonês. Explique a função exata, classe gramatical e significado da palavra solicitada considerando estritamente a frase de contexto enviada. Retorne APENAS JSON.";
                prompt = `Termo: "${body.termo}"\nFrase de Contexto: "${body.fraseContexto}"
                
                Estrutura do JSON esperado:
                {
                    "classe_gramatical": "Substantivo, Verbo, Partícula, etc.",
                    "significado": "Significado geral da palavra.",
                    "funcao_no_contexto": "Explicação da função ou nuance exata que a palavra tem nesta frase.",
                    "leitura": "Leitura em hiragana (opcional, apenas se houver kanji no termo)"
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
