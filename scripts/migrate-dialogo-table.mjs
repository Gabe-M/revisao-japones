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
const credMatch = connectionString.match(/^(postgresql:\/\/[^:]+:)\[([^\]]+)\](@.+)$/);
if (credMatch) {
  const password = encodeURIComponent(credMatch[2]);
  connectionString = `${credMatch[1]}${password}${credMatch[3]}`;
  console.log('ℹ️  Senha normalizada (colchetes removidos, caracteres encodados)');
}
console.log('🔌 Conectando ao Supabase...');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const SQL = `
-- =============================================================
-- Tabela: dialogo_sessoes
-- Armazena as sessões de diálogo do usuário
-- =============================================================

CREATE TABLE IF NOT EXISTS public.dialogo_sessoes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome         text NOT NULL,
  config       jsonb DEFAULT '{}'::jsonb NOT NULL,
  guia_dados   jsonb,
  historico    jsonb DEFAULT '[]'::jsonb NOT NULL,
  contexto     text,
  traducao_dados jsonb,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.dialogo_sessoes ADD COLUMN IF NOT EXISTS traducao_dados jsonb;

-- RLS: cada usuário só acessa suas próprias sessões
ALTER TABLE public.dialogo_sessoes ENABLE ROW LEVEL SECURITY;

-- Remove política existente se houver (idempotente)
DROP POLICY IF EXISTS "Usuarios acessam apenas suas proprias sessoes" ON public.dialogo_sessoes;

CREATE POLICY "Usuarios acessam apenas suas proprias sessoes"
  ON public.dialogo_sessoes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS dialogo_sessoes_user_id_idx ON public.dialogo_sessoes (user_id);
`;

try {
  await client.connect();
  console.log('✅ Conectado com sucesso!\n');

  await client.query(SQL);

  console.log('✅ Tabela dialogo_sessoes criada (ou já existia)');
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
