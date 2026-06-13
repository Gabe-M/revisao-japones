const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { acao } = req.query;

    // Captura o token de quem está logado
    const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;

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

            // Algoritmo simplificado de 2 botões
            let novoIntervalo = 0;
            let novasRepeticoes = 0;
            const agora = Date.now();

            if (estado === 'errei') {
                novasRepeticoes = 0;
                novoIntervalo = 0;
                card.lapses = (card.lapses || 0) + 1;
            } else if (estado === 'acertei') {
                novasRepeticoes = card.repetitions + 1;
                // Escala fixa: 1, 3, 7, 14, 30, 90, 180...
                const escala = [1, 3, 7, 14, 30, 90, 180, 360];
                const index = Math.min(novasRepeticoes - 1, escala.length - 1);
                novoIntervalo = escala[index];
            }

            const novaDue = agora + novoIntervalo * 24 * 60 * 60 * 1000;

            const payload = {
                user_id: user_id,
                item: item,
                ease: 2.5,
                interval: novoIntervalo,
                repetitions: novasRepeticoes,
                due: novaDue,
                lapses: card.lapses
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
