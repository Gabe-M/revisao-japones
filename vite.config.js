import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Plugin para simular funções serverless da Vercel (/api/*) no Vite
const vercelApiPlugin = () => ({
  name: 'vercel-api-dev',
  configureServer(server) {
    // Carrega o .env local para process.env para que a API possa usar SUPABASE_URL etc
    const env = loadEnv(server.config.mode, process.cwd(), '');
    Object.assign(process.env, env);

    server.middlewares.use('/api/', async (req, res, next) => {
      try {
        const route = req.url.split('?')[0].replace(/^\//, ''); // Ex: 'jisho'
        const filePath = resolve(__dirname, 'api', route + '.js');
        
        if (!fs.existsSync(filePath)) {
            return next();
        }

        const fileUrl = pathToFileURL(filePath).href;
        const module = await import(fileUrl + '?t=' + Date.now()); // Cache buster
        
        if (module && module.default) {
            // Mock de query e body para os handlers Vercel
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            req.query = Object.fromEntries(urlObj.searchParams);
            
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                await new Promise((resolve) => {
                    let body = '';
                    req.on('data', chunk => body += chunk.toString());
                    req.on('end', () => {
                        try { req.body = body ? JSON.parse(body) : {}; } catch(e) { req.body = body; }
                        resolve();
                    });
                });
            }
            
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            };
            
            await module.default(req, res);
        } else {
            next();
        }
      } catch (err) {
        console.error("API Error:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), vercelApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        perfil: resolve(__dirname, 'perfil.html'),
        frases: resolve(__dirname, 'frases.html'),
        login: resolve(__dirname, 'login.html'),
        minigame: resolve(__dirname, 'minigame.html'),
        quiz: resolve(__dirname, 'quiz.html'),
        setup: resolve(__dirname, 'setup.html'),
        srs: resolve(__dirname, 'srs.html'),
        textos: resolve(__dirname, 'textos.html'),
        dialogo: resolve(__dirname, 'dialogo.html')
      }
    }
  }
});
