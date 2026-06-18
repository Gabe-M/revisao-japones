# Ferramenta de Apoio ao Diálogo (Modal Contextual)

Adicionar um modal de assistência contextual à tela de Diálogo. O modal é acionado por botões discretos em cada mensagem da IA no chat. Ele contém 4 abas que ajudam o usuário a entender a mensagem recebida, formular uma resposta e praticar — sem quebrar o fluxo do diálogo real.

## Decisões de Design Confirmadas

| Ponto | Decisão |
|---|---|
| Formato | Modal flutuante sobre o chat |
| Gatilho | Botões contextuais por mensagem (💬 Ajuda) |
| Organização | 4 abas dentro do modal |
| Aba inicial | Usuário escolhe |
| Sugestão | Copia para o input do chat |
| Prática | Feedback isolado; pode ser promovido a resposta real |

---

## Proposed Changes

### Novo componente

#### [NEW] AjudaModal.tsx
`src/dialogo/components/AjudaModal.tsx`

Modal com 4 abas acionado pela mensagem da IA atual. Recebe como props:
- `mensagem` — a frase em japonês da IA (com tags ruby)
- `context` — dados de tema, jlpt e vocabularioBanco
- `provider` — provedor de IA atual
- `isOpen / onClose` — controle de visibilidade
- `onUsarResposta(texto)` — callback para copiar texto para o input do chat

**Aba 1 — 📖 Vocabulário**
- Carrega automaticamente ao abrir (novo endpoint de análise da IA)
- Exibe lista de palavras-chave extraídas da mensagem da IA: kanji + furigana + leitura + significado
- Cada word chip usa `FuriganaText` com hover expandido
- Exibe `AiLoader` enquanto busca

**Aba 2 — 💡 Sugestão**
- Botão "Gerar Sugestão" chama a IA ao clicar
- A IA retorna uma frase sugerida de resposta para a mensagem atual
- Exibida com `FuriganaText` + tradução + dica gramatical
- Botão "✅ Usar esta resposta" chama `onUsarResposta(frase_jp_limpa)`

**Aba 3 — ❓ Dúvida**
- Campo de texto livre para o usuário digitar uma dúvida sobre a fala da IA
- Botão "Perguntar" chama a IA com contexto da mensagem + dúvida
- Resposta exibida com suporte a furigana

**Aba 4 — 🎯 Praticar**
- Campo de input com wanakana binding (romaji → hiragana automático)
- Botão "Analisar" → IA analisa sem adicionar ao histórico real
- Exibe score + feedback + pontos de melhoria
- Botão "▶ Usar como resposta real" chama `onUsarResposta(texto_praticado)` e fecha o modal

---

### Backend

#### [MODIFY] api/dialogo.js
Novas ações no `switch (acao)`:

- **`analisar_mensagem`**: Recebe `mensagem_ia_jp` + contexto. Retorna `{ vocabulario: [{item, leitura, significado, tipo}] }` com as palavras-chave da mensagem.
- **`sugerir_resposta`**: Recebe `mensagem_ia_jp` + contexto + vocabulario. Retorna `{ sugestao_jp, sugestao_pt, dica }` — frase sugerida de resposta ao personagem com furigana.
- **`tirar_duvida`**: Recebe `mensagem_ia_jp` + `duvida_usuario` + contexto. Retorna `{ resposta }` — resposta da IA à dúvida do usuário sobre a fala.
- **`analisar_pratica`**: Recebe `mensagem_ia_jp` + `resposta_usuario_jp`. Retorna `{ score, correto, erros, dica, traducao_correta }` — mesmo schema de `analisar_traducao`.

---

### Tela do Diálogo

#### [MODIFY] DialoGoPanel.tsx
- Adicionar estado `ajudaModal: { isOpen: boolean, mensagem: string }`
- Em cada balão de mensagem da IA, adicionar botão **💬 Ajuda** abaixo do texto
- Ao clicar, seta `ajudaModal` com a mensagem daquele balão específico
- Renderizar `AjudaModal` no final do componente com os props necessários
- `onUsarResposta(texto)` seta `inputUser = texto` e fecha o modal

---

## Verification Plan

### Automated Tests
- `npm run build` sem erros

### Manual Verification
- Clicar em "Ajuda" em uma mensagem da IA e verificar que o modal abre
- Testar as 4 abas individualmente
- Verificar que "Usar esta resposta" preenche o input corretamente
- Verificar furigana correto nas palavras do vocabulário
- Verificar que a prática não afeta o histórico real do diálogo


Este plano estende o visual do diálogo adicionando a flexibilidade de selecionar Baralhos, Conjuntos ou ambos (com filtros de SRS como "Aprendidos" ou "Novos") a partir do "Meu Banco de Palavras".

## User Review Required

> [!IMPORTANT]
> Quando o usuário selecionar "Meu Banco de Palavras", ele agora terá as seguintes opções:
> - **Tipo de Filtro**: Conjuntos, Baralhos ou Ambos.
> - **Filtro SRS** (disponível quando Baralhos ou Ambos estiver selecionado): Ambos (Todos), Já Aprendidos ou Não Aprendidos.
> - O vocabulário carregado no diálogo respeitará essa combinação exata de filtros, buscando o progresso do SRS no banco do Supabase e as informações de baralho do Anki.

## Proposed Changes

### React Component: Configuração do Diálogo

#### [MODIFY] [ConfiguracaoPanel.tsx](file:///c:/Users/Fabiano/Downloads/sites/japones/src/dialogo/ConfiguracaoPanel.tsx)
- **Estados Adicionais**:
  - `bancoTipo`: `'conjuntos' | 'baralhos' | 'ambos'` (valor inicial `'conjuntos'`).
  - `baralhosDisp`: lista de baralhos únicos encontrados no banco de dados.
  - `baralhoSelecionado`: baralho atualmente selecionado.
  - `srsFiltro`: `'Todos' | 'Aprendidos' | 'Novos'` (valor inicial `'Todos'`).
- **Função `carregarConjuntos` (rebatizada para `carregarDadosBanco`)**:
  - Buscar `conjuntos`, `notas` e `baralhos` da tabela `vocabulario`.
  - Extrair conjuntos das notas (via regex) e do campo `conjuntos`.
  - Extrair baralhos do campo `baralhos`.
  - Atualizar os estados `conjuntosDisp` e `baralhosDisp`.
- **UI do Banco de Palavras**:
  - Exibir controle segmentado para selecionar o tipo de filtro (Conjuntos / Baralhos / Ambos).
  - Exibir os seletores suspensos (selects) de acordo com a seleção ativa.
  - Se "Baralhos" ou "Ambos" estiver selecionado, exibir o seletor segmentado do Filtro SRS.
- **Retorno do `handleStart`**:
  - Enviar objeto de configuração estruturado contendo: `tema`, `useBanco`, `bancoTipo`, `conjuntoSelecionado`, `baralhoSelecionado`, `srsFiltro`, e `jlpt`.

---

### React Component: Orquestrador do Diálogo

#### [MODIFY] [DialoGoApp.tsx](file:///c:/Users/Fabiano/Downloads/sites/japones/src/dialogo/DialoGoApp.tsx)
- **Atualização de Tipos**:
  - Atualizar a assinatura de início e o fluxo para suportar o novo objeto de configuração.
- **Função `fetchVocabulario`**:
  - Buscar os termos da tabela `vocabulario` incluindo as colunas: `item, leitura, significado, jlpt, conjuntos, baralhos, campos_anki, notas`.
  - Buscar o progresso do SRS na tabela `srs_progresso` para cruzar dados de memorização (caso `srsFiltro` não seja `'Todos'`).
  - Filtrar o vocabulário carregado em memória combinando:
    - Filtro de Conjunto (se aplicável).
    - Filtro de Baralho (se aplicável).
    - Filtro de SRS (se aplicável, classificando como aprendido se possuir registro no SRS ou se `campos_anki.queue > 0`).

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
- Acessar a página de diálogo.
- Selecionar "Meu Banco de Palavras".
- Testar a alternância entre Conjuntos, Baralhos e Ambos:
  - Verificar se os dropdowns e filtros SRS surgem e somem de acordo.
  - Selecionar um baralho e o filtro "Já Aprendidos" e iniciar para conferir se apenas termos no SRS/revisados são carregados no diálogo.
  - Selecionar "Ambos" e cruzar um conjunto específico e um baralho.
