import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres:@A1b2c0d2d3x9f1@db.sodqxkvkxifczfscbxwo.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    
    // get a valid user
    const usersRes = await client.query('SELECT id FROM auth.users LIMIT 1');
    if (usersRes.rows.length === 0) {
      console.log("No users found in auth.users! Cannot test insertion.");
      return;
    }
    const dummy_uuid = usersRes.rows[0].id;
    console.log("Using real user_id for test:", dummy_uuid);

    const res = await client.query(`
      INSERT INTO anki_cards (user_id, note_id, deck_name, card_status, vocabulary, reading, meaning, synced_at)
      VALUES ($1, 123456789, 'Test Deck', 'review', 'テスト', 'てすと', 'test', NOW())
      RETURNING *;
    `, [dummy_uuid]);
    console.log("Inserted dummy card successfully:", res.rows[0]);
    
    // Test the API fetching endpoint logic indirectly
    const listRes = await client.query(`
      SELECT deck_name, synced_at, vocabulary FROM anki_cards WHERE user_id = $1 ORDER BY synced_at DESC LIMIT 5
    `, [dummy_uuid]);
    console.table(listRes.rows);

    // clean up
    await client.query("DELETE FROM anki_cards WHERE user_id = $1 AND note_id = 123456789", [dummy_uuid]);
    console.log("Cleaned up dummy card.");
  } catch (err) {
    console.error("DB Insert Error:", err);
  } finally {
    await client.end();
  }
}
run();
