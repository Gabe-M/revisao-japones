# Regras do Projeto — revisao-japones

## Regra 1: Padronização CSS (Tailwind-first)
- **Proibido:** atributos `style={{...}}` inline e variáveis CSS brutas (`var(--card-bg)`, `var(--text-color)`, etc.)
- **Obrigatório:** substituição por classes utilitárias Tailwind equivalentes
- Exemplos de mapeamento:
  - `style={{ display: 'flex' }}` → `className="flex"`
  - `style={{ background: 'var(--card-bg)' }}` → `className="bg-card"`
  - `style={{ color: 'var(--text-color)' }}` → `className="text-foreground"`
  - `style={{ border: '1px solid var(--border-color)' }}` → `className="border border-border"`
  - `style={{ paddingBottom: '60px' }}` → `className="pb-16"`

## Regra 2: Consistência de Tema (shadcn/Tailwind tokens)
- Usar exclusivamente os tokens de cor do shadcn configurados no projeto:
  - Fundos: `bg-background`, `bg-card`, `bg-muted`, `bg-popover`
  - Texto: `text-foreground`, `text-muted-foreground`, `text-card-foreground`
  - Borda: `border-border`, `border-input`
  - Ação primária: `bg-primary`, `text-primary-foreground`
  - Ação secundária: `bg-secondary`, `text-secondary-foreground`
  - Destaque: `bg-accent`, `text-accent-foreground`
  - Perigo: `bg-destructive`, `text-destructive-foreground`
- Tema escuro: garantido via classe `.dark` (configurada no `tailwind.config.js` com `darkMode: ["class"]`)
- Nunca criar cores hardcoded (ex: `bg-[#121212]`) quando existir um token semântico equivalente

## Regra 3: Imutabilidade Lógica
- Ao substituir elementos HTML nativos (`<div>`, `<button>`, `<input>`) por componentes shadcn/UI:
  - **Preservar intactos:** `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`
  - **Preservar intactos:** todos os event handlers (`onClick`, `onChange`, `onSubmit`, `onValueChange`)
  - **Preservar intactas:** todas as props passadas a componentes filhos
  - **Escopo da alteração:** restrito à camada estrutural e visual (JSX de layout, className, imports de UI)
  - A lógica de negócio, fetch de dados e gerenciamento de estado são zonas protegidas
