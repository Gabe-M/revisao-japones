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

// Verificar tabela e colunas
const cols = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'anki_cards'
  ORDER BY ordinal_position;
`);

// Verificar políticas RLS
const policies = await client.query(`
  SELECT policyname, cmd FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'anki_cards';
`);

// Verificar índices
const indexes = await client.query(`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'anki_cards';
`);

console.log('\n📋 Colunas da tabela anki_cards:');
cols.rows.forEach(r => console.log(`  - ${r.column_name.padEnd(15)} ${r.data_type}`));

console.log('\n🔒 Políticas RLS:');
policies.rows.forEach(r => console.log(`  - ${r.policyname} (${r.cmd})`));

console.log('\n🗂️  Índices:');
indexes.rows.forEach(r => console.log(`  - ${r.indexname}`));

await client.end();
