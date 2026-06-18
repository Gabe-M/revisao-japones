async function ankiAction(action, params = {}) {
  const res = await fetch('http://127.0.0.1:8765', {
    method: 'POST',
    body: JSON.stringify({ action, version: 6, params }),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (data.error) throw new Error(`AnkiConnect: ${data.error}`);
  return data.result;
}

async function test() {
  try {
    console.log("Finding cards via fetch...");
    const cardIds = await ankiAction('findCards', { query: 'deck:"Kaishi 1.5k"' });
    console.log(`Cards: ${cardIds.length}`);
    
    console.log("Fetching cards info via fetch...");
    const cardsInfo = await ankiAction('cardsInfo', { cards: cardIds.slice(0, 5) });
    console.log("Card vocab:", cardsInfo.map(c => Object.values(c.fields)[0].value));
  } catch(e) { console.error("Error:", e.message); }
}
test();
