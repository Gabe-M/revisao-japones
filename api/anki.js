const SUPABASE_URL = "https://sodqxkvkxifczfscbxwo.supabase.co";
const SUPABASE_KEY = "sb_publishable_qanav-1ayeNA40f692w2Xg_qqGnFcuG";

function obterUserIdDoToken(authHeader) {
  console.log("obterUserIdDoToken: authHeader received =", authHeader ? (authHeader.substring(0, 30) + "...") : "null");
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.substring(7);
    const parts = token.split('.');
    console.log("obterUserIdDoToken: token split parts length =", parts.length);
    if (parts.length !== 3) {
      console.log("obterUserIdDoToken: Not a 3-part JWT token");
      return null;
    }
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decodedStr = Buffer.from(base64, 'base64').toString('utf-8');
    console.log("obterUserIdDoToken: decoded JWT payload =", decodedStr);
    const payload = JSON.parse(decodedStr);
    console.log("obterUserIdDoToken: payload.sub =", payload?.sub, "payload.role =", payload?.role);
    if (payload?.sub && payload.role === 'authenticated') return payload.sub;
  } catch (err) { 
    console.error("obterUserIdDoToken error:", err);
  }
  return null;
}

export default async function handler(req, res) {
  try {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { acao } = req.query;
  const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;
  const userId = obterUserIdDoToken(tokenUsuario);

  if (!userId) return res.status(401).json({ error: 'Não autenticado' });

  // AÇÃO: Sincronizar cartões do Anki com o Supabase
  if (acao === 'sincronizar' && req.method === 'POST') {
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const cards = Array.isArray(corpo) ? corpo : [corpo];

    const payload = cards.map(card => ({
      user_id:     userId,
      note_id:     card.noteId,
      deck_name:   card.deckName,
      card_status: card.status,
      vocabulary:  card.vocabulary,
      reading:     card.reading,
      meaning:     card.meaning,
      sentence:    card.sentence,
      audio:       card.audio,
      image:       card.image,
      tags:        card.tags,
      synced_at:   new Date().toISOString(),
    }));

    const response = await fetch(`${SUPABASE_URL}/rest/v1/anki_cards`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: tokenUsuario,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });

    const resultado = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: resultado });
    return res.status(200).json({ sincronizados: payload.length, resultado });
  }

  // AÇÃO: Listar cartões já sincronizados
  if (acao === 'listar' && req.method === 'GET') {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/anki_cards?user_id=eq.${userId}&order=vocabulary.asc`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: tokenUsuario },
      }
    );
    const dados = await response.json();
    return res.status(200).json(dados);
  }

  return res.status(400).json({ error: 'Ação desconhecida' });
  } catch (globalErr) { return res.status(500).json({ error: 'ERRO CATCH NO HANDLER', stack: globalErr.stack, msg: globalErr.message }); }
}
