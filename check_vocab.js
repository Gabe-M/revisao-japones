import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:@A1b2c0d2d3x9f1@db.sodqxkvkxifczfscbxwo.supabase.co:5432/postgres'
});

async function check() {
  try {
    await client.connect();
    
    console.log("=== VOCABULARIO COLUMNS ===");
    const vocabCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vocabulario'");
    console.log(JSON.stringify(vocabCols.rows, null, 2));

    console.log("\n=== ANKI CARDS COLUMNS ===");
    const ankiCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'anki_cards'");
    console.log(JSON.stringify(ankiCols.rows, null, 2));

    const distinctVocabBaralhos = await client.query(`
      SELECT DISTINCT unnest(baralhos) as baralho 
      FROM vocabulario 
      WHERE baralhos IS NOT NULL
    `);
    console.log("\n=== DISTINCT BARALHOS IN VOCABULARIO ===");
    console.log(JSON.stringify(distinctVocabBaralhos.rows, null, 2));

    console.log("\n=== ANKI CARDS BARALHOS ===");
    const ankiBaralhos = await client.query("SELECT DISTINCT baralho FROM anki_cards WHERE baralho IS NOT NULL");
    console.log(JSON.stringify(ankiBaralhos.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
