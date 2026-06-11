export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { termo } = req.query;
    
    if (!termo) {
        return res.status(400).json({ error: 'Termo ausente' });
    }
    
    try {
        const urlJisho = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(termo)}`;
        const response = await fetch(urlJisho);
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao consultar o Jisho' });
    }
}