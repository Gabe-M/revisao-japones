import pg from 'pg';
const { Client } = pg;

const ANKI_URL = 'http://localhost:8765';
const ANKI_VERSION = 6;

// utils
function cleanAnkiString(str) { return str ? str.replace(/<[^>]*>?/gm, '').trim() : ''; }
function mapCardStatus(queue) { return queue === 0 ? 'new' : queue === 1 || queue === 3 ? 'learning' : 'review'; }

async function ankiAction(action, params = {}) {
  const res = await fetch(ANKI_URL, {
    method: 'POST',
    body: JSON.stringify({ action, version: ANKI_VERSION, params }),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (data.error) throw new Error(`AnkiConnect: ${data.error}`);
  return data.result;
}

const client = new Client({
  connectionString: 'postgresql://postgres:@A1b2c0d2d3x9f1@db.sodqxkvkxifczfscbxwo.supabase.co:5432/postgres'
});

async function runTest() {
  try {
    const deckName = 'Kaishi 1.5k';
    console.log(`\n1. Extraindo "${deckName}" do Anki...`);
    
    const cardIds = await ankiAction('findCards', { query: `deck:"${deckName}"` });
    console.log(`-> Encontrados ${cardIds.length} cartões totais no baralho.`);
    
    if (cardIds.length === 0) return;

    // Process in batches
    console.log("-> Baixando detalhes dos cartões...");
    const BATCH_SIZE = 100;
    const allCards = [];
    for(let i = 0; i < cardIds.length; i += BATCH_SIZE) {
        const batch = cardIds.slice(i, i + BATCH_SIZE);
        const cardsInfo = await ankiAction('cardsInfo', { cards: batch });
        for(const card of cardsInfo) {
            const fieldValues = Object.values(card.fields);
            allCards.push({
                noteId: card.note,
                deckName: card.deckName,
                status: mapCardStatus(card.queue),
                vocabulary: cleanAnkiString(fieldValues[0]?.value),
                reading: cleanAnkiString(fieldValues[1]?.value),
                meaning: cleanAnkiString(fieldValues[2]?.value)
            });
        }
    }

    console.log(`-> Extraídos com sucesso ${allCards.length} cartões!`);
    console.log(`\n2. Sincronizando com o Banco de Dados Supabase...`);
    await client.connect();

    // get user ID
    const usersRes = await client.query('SELECT id FROM auth.users LIMIT 1');
    const userId = usersRes.rows[0]?.id;
    if (!userId) {
      console.log("Nenhum usuário encontrado no Supabase auth.users.");
      return;
    }

    let synced = 0;
    // unique by noteId to avoid constraint violation like in api/anki.js
    const uniqueCardsMap = new Map();
    for(const c of allCards) uniqueCardsMap.set(c.noteId, c);
    const uniqueCards = Array.from(uniqueCardsMap.values());

    for (const card of uniqueCards) {
      await client.query(`
        INSERT INTO anki_cards (user_id, note_id, deck_name, card_status, vocabulary, reading, meaning, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id, note_id) DO UPDATE SET 
          card_status = EXCLUDED.card_status,
          vocabulary = EXCLUDED.vocabulary,
          reading = EXCLUDED.reading,
          meaning = EXCLUDED.meaning,
          synced_at = EXCLUDED.synced_at
      `, [userId, card.noteId, card.deckName, card.status, card.vocabulary, card.reading, card.meaning]);
      synced++;
    }

    console.log(`-> Sincronizados ${synced} cartões únicos (agrupados por nota) no banco com sucesso!`);

    console.log(`\n3. Acessando os dados no Banco para verificar...`);
    const dbCards = await client.query('SELECT deck_name, vocabulary, reading, card_status FROM anki_cards WHERE deck_name = $1 AND user_id = $2 ORDER BY synced_at DESC LIMIT 5', [deckName, userId]);
    const totalDb = await client.query('SELECT COUNT(*) FROM anki_cards WHERE deck_name = $1 AND user_id = $2', [deckName, userId]);
    
    console.log(`-> Total de cartões gravados no DB para o baralho: ${totalDb.rows[0].count}`);
    console.log("-> Amostra de cartões acessados diretamente do banco:");
    console.table(dbCards.rows);

  } catch (err) {
    console.error("\n[ERRO]", err.message);
  } finally {
    await client.end();
  }
}

runTest();
