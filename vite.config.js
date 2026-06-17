import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
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
        textos: resolve(__dirname, 'textos.html')
      }
    }
  }
});
