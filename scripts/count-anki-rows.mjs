import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, '../.env'), 'utf-8');
const dbUrlMatch = envContent.match(/SUPABASE_DB_URL=(.+)/);
let connectionString = dbUrlMatch[1].trim();
const credMatch = connectionString.match(/^(postgresql:\/\/[^:]+:)\[([^\]]+)\](@.+)$/);
if (credMatch) {
  connectionString = `${credMatch[1]}${encodeURIComponent(credMatch[2])}${credMatch[3]}`;
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();

const countRes = await client.query('SELECT COUNT(*), COUNT(DISTINCT user_id) as users FROM public.anki_cards');
console.log('Total rows in anki_cards:', countRes.rows[0].count);
console.log('Total distinct users in anki_cards:', countRes.rows[0].users);

const sample = await client.query('SELECT user_id, deck_name, vocabulary, synced_at FROM public.anki_cards LIMIT 5');
console.log('Sample rows:', sample.rows);

await client.end();
