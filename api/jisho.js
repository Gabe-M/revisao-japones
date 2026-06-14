const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const { acao, termo } = req.query;

    // Captura o token de quem está logado
    const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;

    // AÇÃO 1: Buscar vocabulário
    if (acao === 'listar') {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?select=*&order=item.asc`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Cache-Control": "no-cache"
                },
                cache: 'no-store'
            });
            const dados = await response.json();
            return res.status(200).json(dados);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao ler o banco' });
        }
    }

    // AÇÃO 2: Salvar palavra nova
    if (acao === 'salvar' && req.method === 'POST') {
        try {
            // CORREÇÃO: Pega o corpo da requisição diretamente, pois a Vercel já o formatou
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario`, {
                method: 'POST',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario, // Usa a identidade real do usuário para o RLS
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                cache: 'no-store',
                body: JSON.stringify(corpo)
            });

            const resultado = await response.json();

            // Intercepta erros reais do Supabase
            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a gravação',
                    detalhes: resultado
                });
            }

            return res.status(201).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor', mensagem: error.message });
        }
    }
 
    // AÇÃO 4: Atualizar termo (ex: trocar de conjunto/categoria)
    if (acao === 'atualizar' && req.method === 'PATCH') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'ID ausente para atualização' });
        try {
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                cache: 'no-store',
                body: JSON.stringify(corpo)
            });

            const resultado = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a atualização',
                    detalhes: resultado
                });
            }

            return res.status(200).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao atualizar', mensagem: error.message });
        }
    }

    // AÇÃO 5: Deletar termo
    if (acao === 'deletar' && (req.method === 'DELETE' || req.method === 'POST')) {
        const { id, item } = req.query;
        if (!id && !item) {
            return res.status(400).json({ error: 'ID ou Item ausente para exclusão' });
        }
        try {
            let urlParam = id ? `id=eq.${id}` : `item=eq.${encodeURIComponent(item)}`;
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?${urlParam}`, {
                method: 'DELETE',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Prefer": "return=representation"
                },
                cache: 'no-store'
            });

            const resultado = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a exclusão',
                    detalhes: resultado
                });
            }

            // se o array vier vazio, nada foi excluido (possivel erro de RLS ou ID inexistente)
            if (Array.isArray(resultado) && resultado.length === 0) {
                return res.status(404).json({ error: 'Nenhum registro excluído (ID não encontrado ou RLS bloqueou).' });
            }

            return res.status(200).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao deletar', mensagem: error.message });
        }
    }

    // AÇÃO 3: Traduzir no Jisho
    if (!termo) return res.status(400).json({ error: 'Termo ausente' });

    try {
        const urlJisho = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(termo)}`;
        const response = await fetch(urlJisho);
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao consultar o Jisho' });
    }
}