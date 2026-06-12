const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { acao, termo } = req.query;

    // Captura o token de quem está logado
    const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;

    // AÇÃO 1: Buscar vocabulário
    if (acao === 'listar') {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?select=*&order=item.asc`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario
                }
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