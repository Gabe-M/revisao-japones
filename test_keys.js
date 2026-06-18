import axios from 'axios';

async function ankiAction(action, params = {}) {
  const res = await fetch('http://127.0.0.1:8765', {
    method: 'POST',
    body: JSON.stringify({ action, version: 6, params }),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  return data.result;
}

async function test() {
    const cardIds = await ankiAction('findCards', { query: 'deck:"Kaishi 1.5k"' });
    const cardsInfo = await ankiAction('cardsInfo', { cards: cardIds.slice(0, 1) });
    console.log(Object.keys(cardsInfo[0]));
}
test();
