# Original User Request

## Initial Request — 2026-07-21T22:47:12Z

Implementar explicações gramaticais, múltiplas sugestões, persistência dupla no banco de vocabulário/SRS e painel de progresso no DialoGo.

Working directory: `c:\Users\Fabiano\Downloads\sites\japones`
Integrity mode: development

---

## ⚠️ Diretivas Globais de Arquitetura e UI (Obrigatório)

1. Stack Restrita: Utilize exclusivamente Shadcn UI e Tailwind CSS v4. Se os componentes não existirem, instale via CLI (ex: `npx shadcn@latest add drawer accordion card hover-card`). Proibido usar CSS customizado.
2. Tratamento de Falhas (Resiliência): Envolva todas as chamadas de API (`/api/dialogo`, `/api/jisho`, `/api/srs`) em blocos `try/catch`. Caso ocorra erro HTTP 500 ou 400, exiba um feedback visual seguro no frontend (ex: Toast ou alerta) sem quebrar o componente.
3. Autenticação Fixa (Prop Drilling): O projeto não usa Context API. O objeto `session` já gerido pelo `DialoGoApp.tsx` deve ser repassado ou utilizado nos componentes filhos. Todas as chamadas autenticadas devem incluir o header obrigatório: `headers['Authorization'] = 'Bearer ' + session.access_token`.

---

## 🎯 Escopo de Execução

### R1. Explicações Gramaticais Estruturadas
- Backend (`api/dialogo.js`): Altere o prompt (system instructions) do case `analisar_pratica`. A IA deve retornar a chave `erros_detalhados` contendo um array de objetos: `{ erro: string, regra_gramatical: string, explicacao: string, exemplo_correto: string }`. Adicione parse JSON seguro antes de enviar a resposta.
- Frontend (`AjudaModal.tsx`): Remova a renderização simples de string de erros. Mapeie o array `erros_detalhados` utilizando o componente `Accordion` do Shadcn UI. O título (trigger) deve ser o `erro`. O conteúdo (content) deve conter a `regra_gramatical`, a `explicacao` (em PT-BR) e o `exemplo_correto`.

### R2. Refatoração de Sugestões de Resposta (Contextuais)
- Frontend (`AjudaModal.tsx`): Altere o fluxo do botão "Sugestão" para lidar com o payload da ação `sugerir_multiplas_respostas` já existente no backend (que retorna array de opções).
- UI: Renderize 3 `Card`s do Shadcn UI (Concordar, Discordar, Perguntar).
- Interação: Cada card deve incluir um botão "✏️ Praticar" (que envia o texto para o input do usuário) e um botão "✅ Usar direto" (que envia a mensagem diretamente ao chat).

### R3. Integração e Persistência de Vocabulário (Jisho + SRS)
- Frontend (`AjudaModal.tsx`): Na aba "Vocabulário Extraído", inclua um botão "💾 Salvar" ao lado de cada palavra.
- Lógica de Fluxo: Ao clicar em "Salvar", execute uma dupla chamada utilizando `session.access_token`:
  1. `POST /api/jisho?acao=salvar`: Envie o payload `{ item, leitura, significado, categoria, jlpt }` para persistir na tabela `vocabulario`.
  2. `POST /api/srs?acao=salvar`: Envie o payload `{ item, repetitions: 0, due: Date.now() }` (e dados adicionais requeridos) para inicializar a tabela `srs_progresso`.
- Estado UI: Durante o request, mostre um loading state. Em caso de sucesso, mude o botão para "✅ Salvo" e aplique `disabled`.

### R4. Drawer de Estatísticas (Dashboard da Sessão)
- Frontend (`DialoGoPanel.tsx`): Adicione um botão "📊 Progresso" na interface principal do chat.
- UI: Ao clicar, dispare um componente `Sheet` ou `Drawer` do Shadcn UI. A abertura deste Drawer não pode desmontar ou alterar o estado atual do `AjudaModal` ou do fluxo do chat.
- Conteúdo do Drawer:
  - Sessão Atual: Calcule dados localmente lendo o array de `historico` da sessão ativa (ex: Contagem de turnos, % de acerto/score médio).
  - Histórico Geral: Faça um fetch via Supabase na tabela `dialogo_sessoes` para listar as últimas práticas do usuário (exibindo data, tema/nome e score final).
  - Feedback Agrupado: Agrupe os tipos de erros (baseado em `regra_gramatical` do R1) cometidos na sessão atual e exiba os mais frequentes.

---

## Acceptance Criteria

### R1 — Erros Gramaticais
- [ ] O response de `analisar_pratica` contém campo `erros_detalhados` com estrutura `{ erro, regra_gramatical, explicacao, exemplo_correto }[]`
- [ ] A UI renderiza os erros em Accordion (Shadcn): título = erro, conteúdo = regra + explicação + exemplo
- [ ] Respostas sem erros renderizam normalmente (array vazio não quebra o componente)

### R2 — Múltiplas Sugestões
- [ ] Botão "Sugestão" aciona `sugerir_multiplas_respostas` e renderiza 3 cards distintos
- [ ] Cada card tem botões "Praticar" e "Usar direto" funcionais
- [ ] Build do projeto passa sem erros de TypeScript

### R3 — Salvar Vocabulário
- [ ] Botão "💾 Salvar" visível em cada card da aba "Vocabulário Extraído"
- [ ] Clicar executa as duas chamadas (jisho + srs) com o token correto
- [ ] Estado do botão muda para "✅ Salvo" e fica desabilitado após sucesso

### R4 — Drawer de Progresso
- [ ] Botão "📊 Progresso" visível no DialoGoPanel
- [ ] Sheet/Drawer abre sem desmontar o estado do chat ou do AjudaModal
- [ ] Drawer exibe score médio, número de turnos e lista de sessões anteriores do Supabase

### Geral
- [ ] `npm run build` executa sem erros após todas as mudanças
- [ ] Nenhuma chamada de API sem tratamento de erro (try/catch ausente)
