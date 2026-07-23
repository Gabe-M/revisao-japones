# Original User Request

## Initial Request — 2026-07-22T10:44:02Z

Implementar pipeline de enriquecimento de dados (Jisho + LLM) e envio automático via AnkiConnect com auto-criação de Modelo e Baralho no aplicativo de estudo de japonês.

Working directory: `c:\Users\Fabiano\Downloads\sites\japones`
Integrity mode: development

## Requirements

### R1. Sentence Mining (Frontend)
Implementar função utilitária para varrer o `historico` da sessão de trás para frente, buscando a última ocorrência da string `palavra`. Extrair a frase `Exemplo_JP` (limpando tags ruby/HTML) e `Exemplo_PT` correspondente (ou `null` se não houver).

### R2. Camada de Enriquecimento (Backend)
Adicionar `case 'enriquecer_card'` em `api/dialogo.js`.
1. Efetuar fetch em `https://jisho.org/api/v1/search/words?keyword=${palavra}` e isolar `leitura`, `categoria`, `jlpt` e definições em inglês.
2. Usar LLM (`callAI`) com prompt de dicionário para traduzir definições para português estrito.
3. Se `exemplo_pt` for nulo, instruir LLM a traduzir também o `exemplo_jp`.
4. Retornar JSON `{ item, leitura, significado, categoria, jlpt, exemplo_jp, exemplo_pt }`.

### R3. Integração AnkiConnect (`ankiService.ts`)
Criar `src/dialogo/services/ankiService.ts`.
1. Executar `createDeck` com nome `"DialoGo::Vocabulario"`.
2. Verificar `modelNames`. Se `"DialoGo Japones"` não existir, executar `createModel` contendo os 7 campos: `Item`, `Leitura`, `Significado`, `Categoria`, `JLPT`, `Exemplo_JP`, `Exemplo_PT`.
3. Executar `addNote` mapeando o JSON enriquecido para o modelo e baralho.
4. Em chamadas locais (`http://127.0.0.1:8765`), capturar `ERR_CONNECTION_REFUSED` em `try/catch` e disparar toast de erro: `"Anki não está aberto ou AnkiConnect falhou"`.

### R4. Integração de UI
Criar/configurar hook `useToast` do Shadcn UI.
Atualizar `AjudaModal.tsx` e `PalavraNovaPopover.tsx` para importar `ankiService.ts` e `useToast`.
Adicionar botão "🎴 Adicionar ao Anki" com estado `disabled` e spinner durante a execução, e toast de confirmação ao finalizar.

## Acceptance Criteria

### Verification & Quality
- [ ] Backend `api/dialogo.js` possui tratamento seguro para `acao === 'enriquecer_card'`.
- [ ] `session.access_token` é propagado via `Authorization` header em todas as chamadas para o backend.
- [ ] `ankiService.ts` cria baralho `DialoGo::Vocabulario` e modelo `DialoGo Japones` automaticamente caso não existam.
- [ ] Se o Anki estiver fechado, o erro é capturado e exibe o toast `"Anki não está aberto ou AnkiConnect falhou"` via Shadcn `useToast`.
- [ ] Build TypeScript / Vite compila sem erros (`npx tsc --noEmit`).
