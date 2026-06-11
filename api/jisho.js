const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { acao, termo } = req.query;

    // Captura o token de autenticação enviado pelo cabeçalho do Front-end
    const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;

    // AÇÃO 1: Listar vocabulário do usuário logado
    if (acao === 'listar') {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?select=*&order=item.asc`, {
                headers: { 
                    "apikey": SUPABASE_KEY, 
                    "Authorization": tokenUsuario // Repassa o token do usuário para o Supabase validar o RLS
                }
            });
            const dados = await response.json();
            return res.status(200).json(dados);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao ler o banco' });
        }
    }

    // AÇÃO 2: Salvar palavra nova associada ao usuário logado
    if (acao === 'salvar' && req.method === 'POST') {
        try {
            const corpo = JSON.parse(req.body);
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario`, {
                method: 'POST',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario, // Repassa o token do usuário
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify(corpo)
            });
            const resultado = await response.json();
            return res.status(201).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao salvar no banco' });
        }
    }

    // AÇÃO 3: Buscar no Jisho (Lógica livre de autenticação)
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