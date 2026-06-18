async function testAnki() {
    try {
        const res = await fetch('http://127.0.0.1:8765', {
            method: 'POST',
            body: JSON.stringify({action: 'deckNames', version: 6})
        });
        const data = await res.json();
        console.log("AnkiConnect is running. Decks:", data.result);
    } catch (err) {
        console.error("AnkiConnect is NOT running or accessible:", err.message);
    }
}
testAnki();
