# Skill: Auto-Wrap Japanese Text with `<InteractiveText>`
# Target: Mandatory usage of `<InteractiveText>` for all Japanese language text rendering

## Contexto Operacional
Esta Skill deve ser ativada sempre que o agente gerar, modificar ou inspecionar códigos de interface (React/JSX/TSX) que exibam texto no idioma japonês (Hiragana, Katakana, Kanji ou tags de leitura como `<ruby>`).

## Diretrizes de Geração de Código
1. **Prevalência do Componente**: É estritamente proibido criar elementos de texto japonês "cru" (raw strings), ou usar o componente antigo `<FuriganaText />`. Todo e qualquer texto em japonês a ser renderizado na tela deve ser encapsulado pelo componente `<InteractiveText>`.
2. **Exemplo de Envelopamento**:
   - *Incorreto*: `<span>こんにちは</span>`
   - *Incorreto*: `<FuriganaText text="こんにちは" />`
   - *Correto*: `<InteractiveText><span>こんにちは</span></InteractiveText>` ou `<InteractiveText text="こんにちは" />`
3. **Resolução de Import**: Ao utilizar o componente, certifique-se de importar corretamente o componente de forma relativa a partir de `@/components/InteractiveText` ou calculando o caminho relativo apropriado.
4. **Prevenção de Falsos Positivos**: Não aplique o envelopamento em comentários, instruções de log (`console.log`), imports, chaves de objetos JS ou chamadas de API de backend. Apenas textos renderizados no JSX devem ser envelopados.

## Comportamento do Agente (Prompt Guardrail)
Toda nova tela, modal, aba ou componente criado pelo agente contendo texto em japonês já deve vir escrito de primeira usando `<InteractiveText>` para minimizar processamento e correções em segundo plano.

## Validação de Sucesso
- Verificar se o import de `InteractiveText` está presente no topo dos arquivos modificados.
- Executar build do projeto para garantir conformidade de tipo e compilação do TypeScript.
