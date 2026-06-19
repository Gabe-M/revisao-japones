# Preenchimento de Lacunas Assistido (Contextual Placeholder)

Implementar um sistema interativo na aba "Praticar" do modal de ajuda, permitindo que o usuário escreva palavras em português entre colchetes (ex: "私は [maçã] を食べます") e receba sugestões contextuais de japonês adequadas para preencher o espaço.

## User Review Required

> [!IMPORTANT]
> **Nova Ação de Backend (`sugerir_lacuna`)**:
> Adição de um novo endpoint no backend (`api/dialogo.js`) que recebe a frase e o termo em português e gera até 3 sugestões apropriadas com tags ruby/furigana e texto puro.
> 
> **Visual Live Preview**:
> Como não é possível interagir com elementos HTML dentro de uma caixa de texto padrão (`<input>`/`<textarea>`), criamos uma área de pré-visualização em tempo real (Live Preview) logo abaixo do campo, onde as lacunas entre colchetes viram chips interativos clicáveis.

## Proposed Changes

---

### Backend (API)

#### [MODIFY] [dialogo.js](file:///c:/Users/Fabiano/Downloads/sites/japones/api/dialogo.js)
- **Adicionar caso `sugerir_lacuna`**:
  - Parâmetros: `frase_contexto` (a frase com colchetes) e `termo_pt` (termo interno).
  - Configurar `systemInstruction` para agir como assistente de tradução de japonês focado no preenchimento de termos adequados para a frase e gramática fornecidas. Exigir tags `<ruby>` e `<rt>` com furigana em Hiragana na propriedade `termo_jp` da resposta.
  - Estrutura de retorno:
    ```json
    {
      "sugestoes": [
        {
          "termo_jp": "<ruby>林檎<rt>りんご</rt></ruby>",
          "texto_puro": "りんご",
          "explicacao_curta": "Termo geral para maçã."
        }
      ]
    }
    ```

---

### Frontend

#### [MODIFY] [AjudaModal.tsx](file:///c:/Users/Fabiano/Downloads/sites/japones/src/dialogo/components/AjudaModal.tsx)
- **Novos Estados**:
  - `lacunaAtiva`: Armazena o termo clicado e seu correspondente bruto (ex: `{ termoPt: 'maçã', raw: '[maçã]' }`).
  - `sugestoesLacuna`: Array de sugestões retornadas pela API.
  - `loadingLacuna`: Flag boolean de carregamento da chamada de lacuna.
- **Função `sugerirLacuna(termoPt, raw)`**:
  - Disparar requisição `POST` para `/api/dialogo` com `acao: 'sugerir_lacuna'`, passando `frase_contexto` (`praticaInput`) e `termo_pt` (`termoPt`).
  - Atualizar os estados de carregamento e o array de sugestões.
- **Renderização do Live Preview (aba Praticar)**:
  - Adicionar expressão regular `\[(.*?)\]` para dividir `praticaInput` e renderizar as partes estáticas em `<span>` e as partes dinâmicas em `<button>` (estilizado como chip).
- **Popover de Sugestões**:
  - Exibir card flutuante posicionado abaixo do Live Preview se houver carregamento ativo ou sugestões disponíveis.
  - Exibir sugestões usando `<FuriganaText />` e explicação curta.
  - Ao selecionar uma sugestão, substituir o termo original entre colchetes pela propriedade `texto_puro` e fechar o popover.

---

## Verification Plan

### Automated Tests
- Executar `npm run build` para garantir conformidade de tipo e compilação do TypeScript.

### Manual Verification
- Na aba "Praticar", digitar a frase `"私は [maçã] を食べます"`.
- Verificar se a pré-visualização exibe o botão `"maçã"` estilizado.
- Clicar no botão, esperar o carregamento e checar se o card flutuante exibe `"りんご"` ou `"林檎"`.
- Clicar na sugestão desejada e verificar se o input é substituído para `"私はりんごを食べます"` e o card é fechado.
