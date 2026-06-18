# Skill: Supabase Direct Database Integration
# Target: Automated backend database operations via SUPABASE_DB_URL

## Contexto Operacional
Esta Skill deve ser ativada sempre que o usuário solicitar persistência de dados, criação de tabelas, rotas de API ou modelos de dados. O agente deve operar via conexão direta com o banco de dados (PostgreSQL).

## Diretrizes de Configuração do Ambiente
1. **Verificação da String de Conexão:** O agente deve verificar se o arquivo `.env` contém a variável `SUPABASE_DB_URL`.
2. **Abordagem de Conexão:** Como não há chaves Anon/URL do SDK, o agente deve obrigatoriamente utilizar uma abordagem de backend para se conectar ao banco. Ele está autorizado a instalar e configurar:
   - **Para JavaScript/TypeScript:** ORMs como Prisma, Drizzle ou o driver nativo `pg`.
   - **Para Python:** SQLAlchemy, SQLModel ou `psycopg2`.

## Comportamento do Agente (Workflow Autónomo)
1. **Geração de Código Seguro:** O agente deve ler `process.env.SUPABASE_DB_URL` (ou equivalente na linguagem do projeto). É estritamente proibido expor essa string de conexão no frontend/navegador, pois ela contém a senha mestre do banco de dados. Toda operação deve passar por uma API local ou Server Action.
2. **Migrações Automáticas:** Ao criar novas tabelas, o agente deve gerar e rodar as migrações (ex: `npx prisma migrate dev` ou scripts SQL diretos) via terminal de forma autônoma para estruturar o Supabase.

## Validação de Sucesso
- O agente deve testar a conexão executando uma query simples (ex: `SELECT 1`) em segundo plano para garantir que as credenciais da URL estão corretas antes de renderizar a interface de usuário no navegador embutido.
