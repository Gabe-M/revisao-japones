const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:@A1b2c0d2d3x9f1@db.sodqxkvkxifczfscbxwo.supabase.co:5432/postgres',
});

async function run() {
    try {
        await client.connect();
        console.log('Conectado ao Supabase!');
        
        await client.query(`
            ALTER TABLE vocabulario 
            ADD COLUMN IF NOT EXISTS baralhos text[] DEFAULT '{}'::text[];
        `);
        console.log('Coluna baralhos adicionada com sucesso!');
        
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

run();
