const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function obterUserIdDoToken(authHeader) {
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
            if (payload && payload.sub && payload.role === 'authenticated') {
                return payload.sub;
            }
        }
    } catch (e) {
        console.error("Erro ao decodificar JWT:", e);
    }
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { acao } = req.query;

    // Captura o token de quem está logado
    const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;
    const userId = obterUserIdDoToken(tokenUsuario);

    // AÇÃO 1: Listar progresso do SRS
    if (acao === 'listar') {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/srs_progresso?select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario
                }
            });
            const dados = await response.json();
            
            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a listagem',
                    detalhes: dados
                });
            }
            
            return res.status(200).json(dados);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao ler o banco de dados SRS', mensagem: error.message });
        }
    }

    // AÇÃO 2: Salvar ou fazer UPSERT de progresso (individual ou em lote)
    if (acao === 'salvar' && req.method === 'POST') {
        try {
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            if (userId) {
                if (Array.isArray(corpo)) {
                    corpo.forEach(item => {
                        if (item) item.user_id = userId;
                    });
                } else if (corpo && typeof corpo === 'object') {
                    corpo.user_id = userId;
                }
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/srs_progresso`, {
                method: 'POST',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=representation"
                },
                body: JSON.stringify(corpo)
            });

            const resultado = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a gravação do SRS',
                    detalhes: resultado
                });
            }

            return res.status(201).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao salvar SRS', mensagem: error.message });
        }
    }

    // AÇÃO 3: Avaliar termo (Algoritmo SRS Backend)
    if (req.method === 'PATCH' || acao === 'avaliar') {
        try {
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { item, estado, user_id } = corpo; // estado: "errei" ou "acertei"
            
            if (!item || !estado || !user_id) {
                return res.status(400).json({ error: 'Item, estado e user_id são obrigatórios' });
            }

            // Busca o estado atual
            const responseAtual = await fetch(`${SUPABASE_URL}/rest/v1/srs_progresso?item=eq.${encodeURIComponent(item)}&select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario
                }
            });
            const dadosAtuais = await responseAtual.json();
            
            let card = { ease: 2.5, interval: 0, repetitions: 0, due: 0, lapses: 0 };
            if (responseAtual.ok && dadosAtuais && dadosAtuais.length > 0) {
                card = dadosAtuais[0];
            }

            const agora = Date.now();

            // ===== ALGORITMO PROGRESSIVO =====
            // Fase de Aprendizado (rep < 2): ciclos dentro da sessao
            //   rep=0 -> errei: due = agora (volta na sessao), rep=0
            //   rep=0 -> acertei: due = agora+10min, rep=1
            //   rep=1 -> errei: due = agora (volta na sessao), rep=0
            //   rep=1 -> acertei: due = agora+1dia, rep=2 (GRADUADO)
            //
            // Fase de Revisao (rep >= 2): intervalos crescentes
            //   errei: volta para rep=1, due = agora (ciclo de 10min na proxima sessao)
            //   acertei: rep++, intervalo = escala[rep-2]
            //   Escala gradual e inteligente (dias): 1, 2, 3, 5, 8, 14, 21, 30, 45, 60, 90, 135, 180, 270, 365

            const ESCALA_REVISAO = [1, 2, 3, 5, 8, 14, 21, 30, 45, 60, 90, 135, 180, 270, 365];
            const MINUTOS_10 = 10 * 60 * 1000; // 10 min em ms
            const DIA_MS = 24 * 60 * 60 * 1000;

            let novasRepeticoes = card.repetitions || 0;
            let novoIntervalo = 0; // em dias (0 = mesma sessao)
            let novaDue = agora;
            const novosLapses = estado === 'errei' ? (card.lapses || 0) + 1 : (card.lapses || 0);

            if (novasRepeticoes < 2) {
                // FASE DE APRENDIZADO
                if (estado === 'errei') {
                    novasRepeticoes = 0;
                    novoIntervalo = 0;
                    novaDue = agora; // volta imediatamente na sessao
                } else {
                    novasRepeticoes = novasRepeticoes + 1;
                    if (novasRepeticoes === 1) {
                        // 1a vez certa: volta em 10 min na sessao
                        novoIntervalo = 0;
                        novaDue = agora + MINUTOS_10;
                    } else {
                        // 2a vez certa: GRADUADO para revisao (1 dia)
                        novoIntervalo = 1;
                        novaDue = agora + DIA_MS;
                    }
                }
            } else {
                // FASE DE REVISAO
                if (estado === 'errei') {
                    // Volta para aprendizado
                    novasRepeticoes = 1;
                    novoIntervalo = 0;
                    novaDue = agora + MINUTOS_10; // aparece na proxima sessao em 10 min
                } else {
                    novasRepeticoes = novasRepeticoes + 1;
                    const idxEscala = Math.min(novasRepeticoes - 2, ESCALA_REVISAO.length - 1);
                    novoIntervalo = ESCALA_REVISAO[idxEscala];
                    novaDue = agora + novoIntervalo * DIA_MS;
                }
            }


            const payload = {
                user_id: userId || user_id,
                item: item,
                ease: 2.5,
                interval: novoIntervalo,
                repetitions: novasRepeticoes,
                due: novaDue,
                lapses: novosLapses
            };

            const responsePatch = await fetch(`${SUPABASE_URL}/rest/v1/srs_progresso`, {
                method: 'POST', // UPSERT
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=representation"
                },
                body: JSON.stringify(payload)
            });

            const resultado = await responsePatch.json();

            if (!responsePatch.ok) {
                return res.status(responsePatch.status).json({
                    error: 'O Supabase rejeitou a gravação no PATCH',
                    detalhes: resultado
                });
            }

            // Retorna o novo estado (o primeiro elemento do array retornado pelo upsert)
            return res.status(200).json(Array.isArray(resultado) ? resultado[0] : resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao avaliar SRS', mensagem: error.message });
        }
    }

    // AÇÃO 4: Deletar progresso do SRS
    if (acao === 'deletar' && req.method === 'POST') {
        try {
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { itens } = corpo;

            if (!itens || !Array.isArray(itens) || itens.length === 0) {
                return res.status(400).json({ error: 'Nenhum item especificado para exclusão' });
            }

            // Constrói a lista formatada para PostgREST in.("item1","item2")
            const listaItens = itens.map(i => `"${i.replace(/"/g, '\\"')}"`).join(',');

            const response = await fetch(`${SUPABASE_URL}/rest/v1/srs_progresso?item=in.(${encodeURIComponent(listaItens)})`, {
                method: 'DELETE',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Prefer": "return=representation"
                }
            });

            const resultado = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a deleção',
                    detalhes: resultado
                });
            }

            return res.status(200).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao deletar SRS', mensagem: error.message });
        }
    }

    return res.status(400).json({ error: 'Ação ou método inválido' });
}
