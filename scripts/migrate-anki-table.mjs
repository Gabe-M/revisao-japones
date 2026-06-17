import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lê a DATABASE_URL do .env manualmente
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/SUPABASE_DB_URL=(.+)/);
if (!dbUrlMatch) {
  console.error('❌ SUPABASE_DB_URL não encontrada no .env');
  process.exit(1);
}

let connectionString = dbUrlMatch[1].trim();

// O .env pode ter a senha com colchetes literais: [@senha]
// Vamos normalizar: extrair o que está dentro de [] se houver
// postgresql://postgres:[@senha]@host:5432/db
const credMatch = connectionString.match(/^(postgresql:\/\/[^:]+:)\[([^\]]+)\](@.+)$/);
if (credMatch) {
  // Remove os colchetes da senha e faz URL-encode dos caracteres especiais
  const password = encodeURIComponent(credMatch[2]);
  connectionString = `${credMatch[1]}${password}${credMatch[3]}`;
  console.log('ℹ️  Senha normalizada (colchetes removidos, caracteres encodados)');
}
console.log('🔌 Conectando ao Supabase...');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const SQL = `
-- =============================================================
-- Tabela: anki_cards
-- Armazena cartões sincronizados do AnkiConnect por usuário
-- =============================================================

CREATE TABLE IF NOT EXISTS public.anki_cards (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id      bigint NOT NULL,
  deck_name    text NOT NULL,
  card_status  text NOT NULL CHECK (card_status IN ('new', 'learning', 'review')),
  vocabulary   text,
  reading      text,
  meaning      text,
  sentence     text,
  audio        text,
  image        text,
  tags         text[],
  synced_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, note_id)
);

-- RLS: cada usuário só acessa seus próprios cartões
ALTER TABLE public.anki_cards ENABLE ROW LEVEL SECURITY;

-- Remove política existente se houver (idempotente)
DROP POLICY IF EXISTS "Usuarios acessam apenas seus proprios anki_cards" ON public.anki_cards;

CREATE POLICY "Usuarios acessam apenas seus proprios anki_cards"
  ON public.anki_cards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS anki_cards_user_id_idx ON public.anki_cards (user_id);
CREATE INDEX IF NOT EXISTS anki_cards_status_idx  ON public.anki_cards (user_id, card_status);
CREATE INDEX IF NOT EXISTS anki_cards_deck_idx    ON public.anki_cards (user_id, deck_name);
`;

try {
  await client.connect();
  console.log('✅ Conectado com sucesso!\n');

  await client.query(SQL);

  console.log('✅ Tabela anki_cards criada (ou já existia)');
  console.log('✅ RLS habilitado');
  console.log('✅ Política de segurança aplicada');
  console.log('✅ Índices criados\n');
  console.log('🎉 Migração concluída com sucesso!');
} catch (err) {
  console.error('❌ Erro durante a migração:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
