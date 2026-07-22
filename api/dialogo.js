function cleanAndParseJson(text) {
    if (!text || typeof text !== 'string') return {};
    let clean = text.trim();
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("Erro ao fazer parse do JSON da IA:", e, "Texto:", text);
        throw new Error(`A IA não retornou um JSON válido. Detalhes: ${e.message}`);
    }
}

async function callAI(systemInstruction, messages, geminiKey, openAIKey, groqKey, provider = 'gemini', groqModel = 'llama-3.3-70b-versatile') {
    const isJson = true;

    if (provider === 'gemini') {
        if (!geminiKey) {
            throw new Error("Chave de API do Gemini não configurada.");
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`;
        
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
        return cleanAndParseJson(text);
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
        return cleanAndParseJson(content);
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
        return cleanAndParseJson(content);
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
        return cleanAndParseJson(text);
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
        const parts = token.split('.');
        if (parts.length === 3) {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
            if (payload && payload.sub) {
                return payload.sub;
            }
        }
    } catch (e) {
        console.error("Erro ao decodificar JWT localmente:", e);
    }
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) return user.id;
    } catch (e) {
        console.error("Exceção ao validar token:", e);
    }
    return null;
}

function cleanFuriganaHtml(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]*>/g, '');
}

function sanitizeRubyHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/<ruby>([\s\S]*?)<\/rt>/gi, '<ruby>$1<rt>')
        .replace(/<\/rt>\s*<\/rt>/gi, '</rt>')
        .replace(/<ruby>([\s\S]*?)<rt>([^<]*?)<\/ruby>/gi, '<ruby>$1<rt>$2</rt></ruby>')
        .replace(/<ruby>([\s\S]*?)<\/ruby>\s*<rt>([\s\S]*?)<\/rt>/gi, '<ruby>$1<rt>$2</rt></ruby>');
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key, X-OpenAI-Key, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

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
        const query = req.query || {};
        let body = {};
        if (typeof req.body === 'string' && req.body.trim()) {
            try {
                body = JSON.parse(req.body);
            } catch (e) {
                body = {};
            }
        } else if (req.body && typeof req.body === 'object') {
            body = req.body;
        }

        const acao = body.acao || query.acao;
        const provider = body.provider || query.provider || 'gemini';
        const { tema, jlpt, vocabulario, frase_jp, resposta_pt, historico, resposta_usuario_jp, sessionId, palavras_aprendendo } = body;

        const precisaAuth = ['listar_sessoes', 'criar_sessao'].includes(acao) || !!sessionId;
        if (precisaAuth && !userId) {
            return res.status(401).json({ error: 'Não autorizado. Token de autenticação ausente ou inválido.' });
        }

        // Validação da chave correspondente ao provedor
        if (acao !== 'converter_kanji') {
            if (provider === 'gemini' && !geminiKey) {
                return res.status(401).json({ error: 'Chave de API do Gemini não configurada no .env' });
            }
            if (provider === 'openai' && !openAIKey) {
                return res.status(401).json({ error: 'Chave de API da OpenAI não configurada no .env' });
            }
            if (provider === 'groq' && !groqKey) {
                return res.status(401).json({ error: 'Chave de API do Groq (GROQ_API_KEY) não configurada no .env' });
            }
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

            case 'apagar_sessao':
                if (!userId) {
                    return res.status(401).json({ error: 'Não autorizado. Token de autenticação ausente ou inválido.' });
                }
                try {
                    const { idParaApagar } = body;
                    if (!idParaApagar) {
                        return res.status(400).json({ error: "ID da sessão para apagar é obrigatório." });
                    }
                    const responseDel = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${idParaApagar}&user_id=eq.${userId}`, {
                        method: 'DELETE',
                        headers: {
                            "apikey": SUPABASE_KEY,
                            "Authorization": tokenUsuario
                        }
                    });
                    if (!responseDel.ok) {
                        const errData = await responseDel.json();
                        throw new Error(errData.message || JSON.stringify(errData));
                    }
                    return res.status(200).json({ success: true });
                } catch (err) {
                    console.error("Erro ao apagar sessão:", err);
                    return res.status(500).json({ error: "Erro ao apagar sessão", message: err.message });
                }

            case 'gerar_guia': {
                const { sugestoesPalavras } = body;
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

                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Use tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> nas frases (em 'exemplo_jp', 'jp' de frases_uteis, 'texto_jp' de breakdown, e 'termo' de termos de vocabulario_chave) sempre que usar Kanji. O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji) e deve ser colocado apenas sobre os Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. Você DEVE separar os blocos lógicos/pedagógicos da frase japonesa usando a tag <w>. Agrupe partículas com seus substantivos se achar útil, ou mantenha verbos auxiliares e conjugações unidos (ex: NUNCA separe 'kudasai', agrupe como <w>〜てください</w>). Exemplo de formatação obrigatória: <w>私</w><w>は</w><w><ruby>見<rt>み</rt></ruby>てください</w>. Nunca use tags <span> ou qualquer outra tag HTML além de <ruby>, <rt> e <w>.";
                prompt = `Gere um guia de estudos em japonês para o tema: "${tema}".
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                ${vocabulario && vocabulario.length > 0 ? `Palavras que devem ser priorizadas ou incluídas se possível: ${selectContextualVocab(vocabulario, tema, null, null, 20).join(', ')}` : ''}
                ${sugestoesPalavras ? `CRÍTICO: O usuário solicitou prioridade ou foco nos seguintes conceitos/termos: "${sugestoesPalavras}". Você deve analisar cada termo fornecido (mesmo que escrito em português, inglês, romaji ou kanji direto), identificar seu significado pretendido e convertê-lo para o vocabulário em japonês natural equivalente. Integre esses conceitos convertidos dentro do array de categorias do 'vocabulario_chave' ou use-os como base de construção em 'frases_uteis', aplicando estritamente as tags <ruby> nos Kanjis correspondentes.` : 'Escolha livremente os vocabulários mais adequados para o tema.'}
                
                Estrutura do JSON esperado:
                {
                    "regras": [
                        { "titulo": "Apresentação básica", "termo": "は", "leitura": "wa", "explicacao": "Usa-se a partícula は para marcar o tópico da frase.", "exemplo_jp": "<ruby>私<rt>わたし</rt></ruby>は<ruby>学生<rt>がくせい</rt></ruby>です", "exemplo_pt": "Eu sou estudante" }
                    ],
                    "vocabulario_chave": [
                        {
                            "categoria": "Nome da Categoria (ex: Verbos, Partículas, Profissões)",
                            "termos": [
                                { "termo": "学生", "leitura": "がくせい", "romaji": "gakusei", "traducao": "Estudante", "jlpt": "N5" }
                            ]
                        }
                    ],
                    "frases_uteis": [
                        { 
                            "jp": "<ruby>宜<rt>よろ</rt></ruby>しくお<ruby>願<rt>ねが</rt></ruby>いします", 
                            "pt": "Prazer em conhecê-lo / Conto com você",
                            "breakdown": [
                                { "texto_jp": "<ruby>宜<rt>よろ</rt></ruby>しく", "romaji": "yoroshiku", "traducao": "bem / de forma apropriada" },
                                { "texto_jp": "お<ruby>願<rt>ねが</rt></ruby>いします", "romaji": "onegaishimasu", "traducao": "por favor" }
                            ]
                        }
                    ]
                }
                Retorne no mínimo 3 regras, de 3 a 5 categorias úteis em 'vocabulario_chave' (com 2 a 4 termos por categoria) baseadas estritamente no tema do diálogo atual, e no mínimo 4 frases úteis. Cada item em 'frases_uteis' deve obrigatoriamente conter o array 'breakdown' conforme o esqueleto demonstrado acima.`;
                
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
            }

            case 'gerar_vocabulario_lote': {
                if (!userId) {
                    return res.status(401).json({ error: 'Não autorizado. Token de autenticação ausente ou inválido.' });
                }
                const { tema, jlpt, blacklist, sessionId, categoriaAlvo } = body;

                systemInstruction = "Você é um professor de japonês especialista em vocabulário. Retorne APENAS um JSON válido contendo novos termos de japonês. Nas propriedades 'termo', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes (sem exceção). O furigana deve estar em Hiragana e aplicado apenas sobre Kanjis. Não use nenhuma outra tag HTML além de <ruby> e <rt>. A categoria_sugerida deve ser um texto plano sem tags ruby ou html.";
                prompt = `Gere exatamente 3 novos termos de vocabulário em japonês úteis e altamente relevantes para o tema: "${tema}".
                Nível de dificuldade máximo: ${jlpt || 'N5'}.
                Categoria alvo desejada pelo usuário: "${categoriaAlvo || 'Geral'}".
                
                CRÍTICO: NÃO repita nenhuma palavra presente na seguinte lista negra (blacklist): [${(blacklist || []).join(', ')}].
                
                Estrutura do JSON esperado:
                {
                    "novos_termos": [
                        {
                            "termo": "Kanji do termo (com ruby tags se houver Kanji)",
                            "leitura": "Leitura em hiragana",
                            "romaji": "Leitura em romaji",
                            "traducao": "Tradução curta em português",
                            "categoria_sugerida": "${categoriaAlvo || 'Geral'}"
                        }
                    ]
                }
                Certifique-se de que cada termo tenha a propriedade 'categoria_sugerida' correspondente a "${categoriaAlvo || 'Geral'}".`;

                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                
                // Persistência
                if (sessionId && result && !result.error && Array.isArray(result.novos_termos)) {
                    try {
                        const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}&select=guia_dados`, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario
                            }
                        });
                        const resData = await responseGet.json();
                        if (responseGet.ok && resData && resData[0]) {
                            const currentGuia = resData[0].guia_dados || { regras: [], vocabulario_chave: [], frases_uteis: [] };
                            
                            let vocabArray = currentGuia.vocabulario_chave;
                            let isLegacy = false;
                            
                            if (!vocabArray && currentGuia.vocabulario) {
                                if (Array.isArray(currentGuia.vocabulario) && currentGuia.vocabulario.length > 0 && currentGuia.vocabulario[0].categoria) {
                                    vocabArray = currentGuia.vocabulario;
                                } else {
                                    isLegacy = true;
                                }
                            }
                            
                            if (!vocabArray && !isLegacy) {
                                vocabArray = [];
                                currentGuia.vocabulario_chave = vocabArray;
                            }
                            
                            [...result.novos_termos].reverse().forEach(term => {
                                const catSugerida = term.categoria_sugerida || categoriaAlvo || 'Geral';
                                const itemJp = term.termo || '';
                                const leitura = term.leitura || '';
                                const romaji = term.romaji || '';
                                const traducao = term.traducao || '';
                                
                                if (isLegacy) {
                                    if (!Array.isArray(currentGuia.vocabulario)) {
                                        currentGuia.vocabulario = [];
                                    }
                                    if (!currentGuia.vocabulario.some(t => (t.termo || t.item) === itemJp)) {
                                        currentGuia.vocabulario.unshift({
                                            item: itemJp,
                                            termo: itemJp,
                                            leitura,
                                            romaji,
                                            significado: traducao,
                                            traducao,
                                            jlpt: jlpt || 'N5'
                                        });
                                    }
                                } else {
                                    let catObj = vocabArray.find(c => c.categoria === catSugerida);
                                    if (!catObj) {
                                        catObj = { categoria: catSugerida, termos: [] };
                                        vocabArray.unshift(catObj);
                                    } else {
                                        const idx = vocabArray.indexOf(catObj);
                                        if (idx > 0) {
                                            vocabArray.splice(idx, 1);
                                            vocabArray.unshift(catObj);
                                        }
                                    }
                                    if (!catObj.termos) {
                                        catObj.termos = [];
                                    }
                                    if (!catObj.termos.some(t => (t.termo || t.item) === itemJp)) {
                                        catObj.termos.unshift({
                                            termo: itemJp,
                                            item: itemJp,
                                            leitura,
                                            romaji,
                                            traducao,
                                            significado: traducao,
                                            jlpt: jlpt || 'N5'
                                        });
                                    }
                                }
                            });
                            
                            if (!isLegacy) {
                                currentGuia.vocabulario_chave = vocabArray;
                            }
                            
                            await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                                method: 'PATCH',
                                headers: {
                                    "apikey": SUPABASE_KEY,
                                    "Authorization": tokenUsuario,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ guia_dados: currentGuia })
                            });
                        }
                    } catch (e) {
                        console.error("Erro ao persistir novos termos (lote) no Supabase:", e);
                    }
                }
                return res.status(200).json(result);
            }

            case 'processar_personalizadas': {
                if (!userId) {
                    return res.status(401).json({ error: 'Não autorizado. Token de autenticação ausente ou inválido.' });
                }
                const { tema, jlpt, texto, categoriasExistentes, sessionId, quantidade } = body;

                systemInstruction = "Você é um tradutor e professor de japonês. Traduza e classifique os termos fornecidos pelo usuário. Retorne APENAS um JSON válido. Nas propriedades 'termo', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes. O furigana deve estar em Hiragana. A categoria_sugerida deve ser um texto plano sem tags ruby ou html.";
                prompt = `O usuário forneceu a seguinte lista ou descrição de palavras/termos para tradução e aprendizado: "${texto}".
                Você deve traduzir cada palavra/conceito para o japonês natural adequado ao tema: "${tema}".
                Nível de dificuldade máximo: ${jlpt || 'N5'}.
                
                Você deve classificar cada termo sugerido em uma das categorias já existentes se for semanticamente compatível. As categorias existentes são: [${(categoriasExistentes || []).join(', ')}].
                Se nenhum termo for compatível com as existentes, crie uma nova categoria sugerida apropriada (em português, sem tags html ou ruby).
                
                Gere pelo menos os termos solicitados pelo usuário. Se o usuário solicitou menos de ${quantidade || 3} palavras, você pode complementar com palavras altamente relacionadas ao tema e aos termos enviados até atingir pelo menos ${quantidade || 3} termos no total.
                
                Estrutura do JSON esperado:
                {
                    "novos_termos": [
                        {
                            "termo": "Kanji do termo (com ruby tags se houver Kanji)",
                            "leitura": "Leitura em hiragana",
                            "romaji": "Leitura em romaji",
                            "traducao": "Tradução em português",
                            "categoria_sugerida": "Nome da Categoria (uma das existentes ou nova se incompatível)"
                        }
                    ]
                }`;

                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                
                // Persistência
                if (sessionId && result && !result.error && Array.isArray(result.novos_termos)) {
                    try {
                        const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}&select=guia_dados`, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": tokenUsuario
                            }
                        });
                        const resData = await responseGet.json();
                        if (responseGet.ok && resData && resData[0]) {
                            const currentGuia = resData[0].guia_dados || { regras: [], vocabulario_chave: [], frases_uteis: [] };
                            
                            let vocabArray = currentGuia.vocabulario_chave;
                            let isLegacy = false;
                            
                            if (!vocabArray && currentGuia.vocabulario) {
                                if (Array.isArray(currentGuia.vocabulario) && currentGuia.vocabulario.length > 0 && currentGuia.vocabulario[0].categoria) {
                                    vocabArray = currentGuia.vocabulario;
                                } else {
                                    isLegacy = true;
                                }
                            }
                            
                            if (!vocabArray && !isLegacy) {
                                vocabArray = [];
                                currentGuia.vocabulario_chave = vocabArray;
                            }
                            
                            [...result.novos_termos].reverse().forEach(term => {
                                const catSugerida = term.categoria_sugerida || 'Geral';
                                const itemJp = term.termo || '';
                                const leitura = term.leitura || '';
                                const romaji = term.romaji || '';
                                const traducao = term.traducao || '';
                                
                                if (isLegacy) {
                                    if (!Array.isArray(currentGuia.vocabulario)) {
                                        currentGuia.vocabulario = [];
                                    }
                                    if (!currentGuia.vocabulario.some(t => (t.termo || t.item) === itemJp)) {
                                        currentGuia.vocabulario.unshift({
                                            item: itemJp,
                                            termo: itemJp,
                                            leitura,
                                            romaji,
                                            significado: traducao,
                                            traducao,
                                            jlpt: jlpt || 'N5'
                                        });
                                    }
                                } else {
                                    let catObj = vocabArray.find(c => c.categoria === catSugerida);
                                    if (!catObj) {
                                        catObj = { categoria: catSugerida, termos: [] };
                                        vocabArray.unshift(catObj);
                                    } else {
                                        const idx = vocabArray.indexOf(catObj);
                                        if (idx > 0) {
                                            vocabArray.splice(idx, 1);
                                            vocabArray.unshift(catObj);
                                        }
                                    }
                                    if (!catObj.termos) {
                                        catObj.termos = [];
                                    }
                                    if (!catObj.termos.some(t => (t.termo || t.item) === itemJp)) {
                                        catObj.termos.unshift({
                                            termo: itemJp,
                                            item: itemJp,
                                            leitura,
                                            romaji,
                                            traducao,
                                            significado: traducao,
                                            jlpt: jlpt || 'N5'
                                        });
                                    }
                                }
                            });
                            
                            if (!isLegacy) {
                                currentGuia.vocabulario_chave = vocabArray;
                            }
                            
                            await fetch(`${SUPABASE_URL}/rest/v1/dialogo_sessoes?id=eq.${sessionId}`, {
                                method: 'PATCH',
                                headers: {
                                    "apikey": SUPABASE_KEY,
                                    "Authorization": tokenUsuario,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ guia_dados: currentGuia })
                            });
                        }
                    } catch (e) {
                        console.error("Erro ao persistir novos termos (personalizados) no Supabase:", e);
                    }
                }
                return res.status(200).json(result);
            }

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

                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Em 'frase_jp', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby> (nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji) e deve ser colocado apenas sobre os Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. Você DEVE separar os blocos lógicos/pedagógicos da frase japonesa usando a tag <w>. Agrupe partículas com seus substantivos se achar útil, ou mantenha verbos auxiliares e conjugações unidos (ex: NUNCA separe 'kudasai', agrupe como <w>〜てください</w>). Exemplo de formatação obrigatória: <w>私</w><w>は</w><w><ruby>見<rt>み</rt></ruby>てください</w>. Nunca use tags <span> ou qualquer outra tag HTML além de <ruby>, <rt> e <w>. Restrinja o vocabulário e Kanjis ao solicitado pelo aluno.";
                
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

                systemInstruction = `Você é um personagem em um RPG de conversa em japonês focado no tema: "${tema}". Inicie a conversa. Retorne APENAS um JSON. Importante: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> na mensagem_ia_jp para TODOS os Kanjis presentes (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby>, e não fora (ou seja, nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji), e deve ser aplicado apenas sobre Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. Você DEVE separar os blocos lógicos/pedagógicos da frase japonesa usando a tag <w>. Agrupe partículas com seus substantivos se achar útil, ou mantenha verbos auxiliares e conjugações unidos (ex: NUNCA separe 'kudasai', agrupe como <w>〜てください</w>). Exemplo de formatação obrigatória: <w>私</w><w>は</w><w><ruby>見<rt>み</rt></ruby>てください</w>. Nunca use tags <span> ou qualquer outra tag HTML além de <ruby>, <rt> e <w>.`;
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

                // Determina o turno atual (pares de user+assistant = 1 turno)
                const turnoAtual = Math.floor(activeHistory.filter(m => m.role === 'user').length);
                const podeIntroduzirNovos = turnoAtual >= 3; // só após o turno 3

                // Palavras em aprendizado enviadas pelo frontend
                const palavrasAprendendoArr = Array.isArray(palavras_aprendendo) ? palavras_aprendendo : [];
                const palavrasDificil = palavrasAprendendoArr.filter(p => p.status === 'aprendendo_dificil').map(p => p.item);
                const palavrasMedio = palavrasAprendendoArr.filter(p => p.status === 'aprendendo_medio').map(p => p.item);

                let limitacoesVocabCont = '';
                if (vocabulario && vocabulario.length > 0) {
                    const vocabBase = selectContextualVocab(vocabulario, tema, historicoFiltrado, resposta_usuario_jp, 50);
                    limitacoesVocabCont = `
                    ATENÇÃO CRÍTICA: O aluno usa um filtro de vocabulário aprendido.
                    Você DEVE construir a resposta usando PRINCIPALMENTE Kanjis e palavras desta lista: [${vocabBase.join(', ')}].
                    Use apenas partículas gramaticais básicas e flexões verbais elementares.
                    ${palavrasDificil.length > 0 ? `OBRIGATÓRIO: Inclua pelo menos UMA das seguintes palavras em aprendizado DIFÍCIL na sua resposta (elas são difíceis para o aluno e precisam de reforço urgente): [${palavrasDificil.join(', ')}].` : ''}
                    ${palavrasMedio.length > 0 ? `TENTE incluir pelo menos uma das seguintes palavras em aprendizado MÉDIO (bom para reforço): [${palavrasMedio.join(', ')}].` : ''}
                    ${podeIntroduzirNovos ? `GRADUAL: Você PODE (não obrigatório) introduzir NO MÁXIMO 1 palavra nova (não presente na lista do banco) que seja natural para o contexto. Se introduzir, inclua-a no array palavras_novas_introducidas da resposta.` : 'RESTRIÇÃO: NÃO introduza palavras novas fora da lista acima neste turno.'}`;
                } else if (podeIntroduzirNovos) {
                    const reforcoStr = [
                        palavrasDificil.length > 0 ? `OBRIGATÓRIO: Inclua pelo menos UMA palavra difícil para o aluno: [${palavrasDificil.join(', ')}].` : '',
                        palavrasMedio.length > 0 ? `TENTE incluir uma palavra em aprendizado médio: [${palavrasMedio.join(', ')}].` : ''
                    ].filter(Boolean).join(' ');
                    if (reforcoStr) limitacoesVocabCont = reforcoStr;
                }

                systemInstruction = `Você é um personagem de RPG conversando em japonês e um professor que avalia. Avalie a última fala do aluno em português, e responda no personagem em japonês. Retorne APENAS um JSON. Importante: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> na mensagem_ia_jp para TODOS os Kanjis presentes (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby>, e não fora (ou seja, nunca faça <ruby>Kanji</ruby><rt>furigana</rt>). O furigana deve ser escrito exclusivamente em Hiragana (ex: <ruby>私<rt>わたし</rt></ruby>, nunca romaji), e deve ser aplicado apenas sobre Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. Você DEVE separar os blocos lógicos/pedagógicos da frase japonesa usando a tag <w>. Agrupe partículas com seus substantivos se achar útil, ou mantenha verbos auxiliares e conjugações unidos (ex: NUNCA separe 'kudasai', agrupe como <w>〜てください</w>). Exemplo de formatação obrigatória: <w>私</w><w>は</w><w><ruby>見<rt>み</rt></ruby>てください</w>. Nunca use tags <span> ou qualquer outra tag HTML além de <ruby>, <rt> e <w>.`;
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
                        "mensagem_ia_jp": "Sua resposta no personagem em japonês (com ruby e w tags)",
                        "mensagem_ia_pt": "Tradução da sua resposta",
                        "palavras_novas_introducidas": [] // Array de {item, leitura, significado, tipo} com palavras novas introduzidas nesta resposta. Deixe vazio [] se não houver palavras novas.
                    }`
                });

                result = await callAI(systemInstruction, msgs, geminiKey, openAIKey, groqKey, provider, 'llama-3.3-70b-versatile');

                // Garante que palavras_novas_introducidas seja sempre um array
                if (!Array.isArray(result.palavras_novas_introducidas)) {
                    result.palavras_novas_introducidas = [];
                }

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
                systemInstruction = "Você é um professor de japonês. Retorne APENAS um JSON válido. Identifique o vocabulário chave na mensagem. IMPORTANTE: Não inclua pontuações, símbolos (como !, ., ?, etc.) ou itens com campo 'item' vazio no array de vocabulário.";
                prompt = `Mensagem: "${body.mensagem_ia_jp}"
                Tema: "${tema}"
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                
                Estrutura do JSON esperado:
                {
                    "vocabulario": [
                        { "item": "Kanji ou palavra (NUNCA pontuação, marcador ou vazio)", "leitura": "furigana/leitura", "significado": "Significado em português", "tipo": "Substantivo/Verbo/etc" }
                    ]
                }
                Retorne no máximo 10 itens importantes.`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                
                if (result && Array.isArray(result.vocabulario)) {
                    const punctuationRegex = /^[.,\/#!$%\^&\*;:{}=\-_`~()!?\s、。！?？]+$/;
                    result.vocabulario = result.vocabulario.filter(v => {
                        if (!v || !v.item) return false;
                        const itemClean = v.item.trim();
                        if (itemClean === '') return false;
                        if (punctuationRegex.test(itemClean)) return false;
                        return true;
                    });
                }
                return res.status(200).json(result);

            case 'obter_vocabulario_relacionado':
                systemInstruction = "Você é um professor de japonês auxiliando um estudante. Retorne APENAS um JSON válido contendo vocabulário individual em japonês. IMPORTANTE: Retorne APENAS palavras isoladas ou termos curtos (substantivos, verbos, adjetivos, partículas). É ESTRITAMENTE PROIBIDO retornar frases completas, orações ou junções de palavras.";
                prompt = `Mensagem recebida da IA: "${body.mensagem_ia_jp}"
                Tema do RPG: "${tema}"
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                
                Instruções Obrigatórias:
                1. Sugira de 5 a 8 PALAVRAS OU TERMOS INDIVIDUAIS em japonês (ex: 勇者, 魔法, 探す, 一緒に, どこ) altamente adequados para o aluno USAR na resposta.
                2. NUNCA gere frases completas ou orações (ex: NÃO gere "私の名前は山田です"). Cada item deve ser uma única palavra ou expressão curta isolada (máximo 1 a 3 palavras/conectivo).
                3. REGRA CRÍTICA DE CONTEÚDO: NÃO inclua palavras, Kanjis ou junções de Kanjis que já estejam presentes na mensagem da IA ("${body.mensagem_ia_jp}"). Sugira APENAS NOVOS vocabulários.
                4. Para cada item, indique a leitura (hiragana/furigana), o significado em português, o tipo (Substantivo, Verbo, Expressão, etc) e uma dica curta de uso.
                
                Estrutura do JSON esperado:
                {
                    "vocabulario": [
                        { 
                            "item": "Palavra ou termo isolado (NUNCA frase)", 
                            "leitura": "furigana/hiragana", 
                            "significado": "Significado em português", 
                            "tipo": "Verbo/Substantivo/Expressão/etc",
                            "dica_uso": "Explicação rápida de como usar na resposta"
                        }
                    ]
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                
                if (result && Array.isArray(result.vocabulario)) {
                    const punctuationRegex = /^[.,\/#!$%\^&\*;:{}=\-_`~()!?\s、。！?？]+$/;
                    const msgLimpa = (body.mensagem_ia_jp || '').replace(/<[^>]*>/g, '');
                    const kanjisInMsg = new Set(msgLimpa.match(/[\u4E00-\u9FFF]/g) || []);

                    result.vocabulario = result.vocabulario.filter(v => {
                        if (!v || !v.item) return false;
                        const itemClean = v.item.trim().replace(/<[^>]*>/g, '');
                        if (itemClean === '') return false;
                        if (itemClean.length > 10) return false; // Rejeita frases longas
                        if (/[。！!？?\n,]/.test(itemClean)) return false; // Rejeita frases com pontuação
                        if (punctuationRegex.test(itemClean)) return false;
                        if (msgLimpa.includes(itemClean)) return false; // Rejeita se já está na mensagem

                        // Rejeita se for apenas uma recombinação de Kanjis que já apareceram na mensagem
                        const kanjisInItem = itemClean.match(/[\u4E00-\u9FFF]/g) || [];
                        if (kanjisInItem.length > 0) {
                            const allKanjisExist = kanjisInItem.every(k => kanjisInMsg.has(k));
                            if (allKanjisExist) return false;
                        }

                        return true;
                    });
                }
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
                systemInstruction = `Você é um personagem em um RPG de conversa em japonês focado no tema: "${tema}" e também um professor ajudando o aluno. Retorne APENAS um JSON válido. IMPORTANTE: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> na propriedade 'sugestao_jp' para TODOS os Kanjis presentes (sem exceção). Certifique-se de que a tag <rt> fica DENTRO da tag <ruby>. O furigana deve ser escrito exclusivamente em Hiragana e aplicado apenas sobre Kanjis, nunca sobre palavras que já estão em hiragana ou katakana. Você DEVE separar os blocos lógicos/pedagógicos da frase japonesa usando a tag <w>. Agrupe partículas com seus substantivos se achar útil, ou mantenha verbos auxiliares e conjugações unidos (ex: NUNCA separe 'kudasai', agrupe como <w>〜てください</w>). Exemplo de formatação obrigatória: <w>私</w><w>は</w><w><ruby>見<rt>み</rt></ruby>てください</w>. Nunca use tags <span> ou qualquer outra tag HTML além de <ruby>, <rt> e <w>.`;
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
                if (result && result.sugestao_jp) {
                    result.sugestao_jp = sanitizeRubyHtml(result.sugestao_jp);
                }
                return res.status(200).json(result);

            case 'sugerir_multiplas_respostas': {
                let limitacoesVocabMulti = '';
                if (vocabulario && vocabulario.length > 0) {
                    limitacoesVocabMulti = `
                    IMPORTANTE: O aluno está utilizando um filtro de palavras aprendidas. 
                    Você DEVE obrigatoriamente criar as frases utilizando APENAS Kanjis e palavras que estejam presentes na seguinte lista: [${selectContextualVocab(vocabulario, tema, null, body.mensagem_ia_jp, 40).join(', ')}]. 
                    Para ligar os termos e formar a frase, use apenas partículas gramaticais básicas e flexões verbais elementares. 
                    NÃO introduza de forma alguma novos Kanjis ou palavras complexas que estejam fora dessa lista.`;
                }
                systemInstruction = `Você é um personagem em um RPG de conversa em japonês focado no tema: "${tema}" e também um professor ajudando o aluno. Retorne APENAS um JSON válido. IMPORTANTE: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> em TODOS os campos '_jp' para TODOS os Kanjis presentes (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e aplicado apenas sobre Kanjis. Você DEVE separar os blocos lógicos/pedagógicos usando a tag <w>. Nunca use tags <span> ou qualquer outra tag HTML além de <ruby>, <rt> e <w>.`;
                prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
                Tema do RPG: "${tema}"
                ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
                ${limitacoesVocabMulti}
                
                Gere 3 sugestões de resposta distintas e adequadas ao contexto: uma concordando/aceitando, uma discordando/recusando, e uma fazendo uma pergunta de volta. Adapte ao contexto do tema.
                
                Estrutura do JSON esperado:
                {
                    "sugestoes": [
                        {
                            "intencao": "Concordar",
                            "emoji": "✅",
                            "jp": "Frase em japonês (com ruby tags e <w>)",
                            "pt": "Tradução exata em português",
                            "dica": "Por que essa é uma boa resposta neste contexto"
                        },
                        {
                            "intencao": "Discordar",
                            "emoji": "🙅",
                            "jp": "Frase em japonês (com ruby tags e <w>)",
                            "pt": "Tradução exata em português",
                            "dica": "Por que essa é uma boa resposta neste contexto"
                        },
                        {
                            "intencao": "Perguntar",
                            "emoji": "🤔",
                            "jp": "Frase em japonês (com ruby tags e <w>)",
                            "pt": "Tradução exata em português",
                            "dica": "Por que essa é uma boa resposta neste contexto"
                        }
                    ]
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);
            }

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
                systemInstruction = "Você é um professor de japonês avaliando a resposta do aluno no contexto de um diálogo. Retorne APENAS um JSON válido. O feedback (dica, explicação e regras) DEVE estar em Português (PT-BR). IMPORTANTE: Na propriedade 'traducao_correta', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e deve ser colocado apenas sobre os Kanjis, nunca sobre hiragana ou katakana puro. Não utilize nenhuma outra tag além de <ruby> e <rt>.";
                prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
                Resposta do aluno: "${body.resposta_usuario_jp}"
                
                Avalie se a resposta do aluno faz sentido no contexto da conversa e se a gramática/vocabulário estão corretos.
                Estrutura do JSON esperado:
                {
                    "score": 85, // número de 0 a 100
                    "correto": true, // true se for uma resposta aceitável e compreensível, false caso contrário
                    "erros": ["O aluno usou a partícula errada em X"], // array de strings com erros identificados (vazio se não houver)
                    "erros_detalhados": [
                        {
                            "erro": "Trecho ou conceito errado",
                            "regra_gramatical": "Nome da regra gramatical violada",
                            "explicacao": "Explicação didática detalhada em português de por que está errado e como funciona a regra",
                            "exemplo_correto": "Exemplo prático de frase ou expressão correta em japonês"
                        }
                    ],
                    "dica": "Dica de como soar mais natural ou corrigir o erro.",
                    "traducao_correta": "Sugestão de como o aluno poderia ter formulado essa mesma ideia de forma correta e natural em japonês"
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                
                try {
                    if (!result || typeof result !== 'object') {
                        result = {};
                    }
                    if (!Array.isArray(result.erros_detalhados)) {
                        result.erros_detalhados = [];
                    } else {
                        result.erros_detalhados = result.erros_detalhados.map(e => ({
                            erro: String(e?.erro || ''),
                            regra_gramatical: String(e?.regra_gramatical || 'Gramática'),
                            explicacao: String(e?.explicacao || ''),
                            exemplo_correto: String(e?.exemplo_correto || '')
                        }));
                    }
                    if (!Array.isArray(result.erros)) {
                        result.erros = result.erros_detalhados.map(e => e.erro).filter(Boolean);
                    }
                } catch (errNormalizacao) {
                    console.error("Erro ao normalizar erros_detalhados:", errNormalizacao);
                    if (!result || typeof result !== 'object') result = {};
                    result.erros_detalhados = [];
                    result.erros = result.erros || [];
                }
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

            case 'analisar_selecao_livre':
                systemInstruction = "You are a strict Japanese pedagogical validator. The user selected a substring from a Japanese sentence. Evaluate if the selection makes pedagogical or semantic sense (even if it's a full sentence or a logical block). If the selection cuts a word in half, isolates a particle without its context, or is semantically dead, set 'valido' to false. Otherwise, set 'valido' to true. All text output fields (explicacao, erro, traducao) MUST be written in Portuguese (PT-BR). Retorne APENAS JSON.";
                prompt = `Texto selecionado: "${body.texto_selecionado}"
                Frase de Contexto: "${body.frase_contexto}"
                
                Estrutura do JSON esperado:
                {
                    "valido": true,
                    "erro": "Explicação em português do porquê a seleção é inválida (only if valido is false)",
                    "leitura": "Leitura em hiragana/leitura fonética se aplicável",
                    "traducao": "Tradução do trecho em PT-BR",
                    "explicacao": "Explicação contextual do trecho em PT-BR"
                }`;
                result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
                return res.status(200).json(result);

            case 'converter_kanji': {
                try {
                    const texto = body.texto || body.text || query.texto || query.text;
                    if (!texto || typeof texto !== 'string' || !texto.trim()) {
                        return res.status(400).json({ error: 'Texto não informado' });
                    }
                    const url = `http://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(texto.trim())}`;
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Google Transliterate API retornou status ${response.status}`);
                    }
                    const data = await response.json();
                    return res.status(200).json({
                        status: 'SUCCESS',
                        candidates: Array.isArray(data?.[0]?.[1]) ? data[0][1] : []
                    });
                } catch (err) {
                    console.error("Erro na ação converter_kanji:", err);
                    return res.status(500).json({ error: 'Erro ao converter texto para kanji', message: err.message });
                }
            }

            default:
                return res.status(400).json({ error: 'Ação inválida' });
        }

    } catch (error) {
        console.error("Erro interno no api/dialogo:", error);
        return res.status(500).json({ error: 'Erro no servidor.', message: error.message });
    }
}
