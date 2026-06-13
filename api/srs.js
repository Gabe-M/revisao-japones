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

    // AÇÃO 3: Deletar progresso do SRS
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
