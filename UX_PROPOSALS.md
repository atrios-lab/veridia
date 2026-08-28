# Propostas de UX

Fila de julgamento, não de fatos. O loop de qualidade (`.claude/loop.md`) nunca
implementa o que está aqui — só acrescenta. Corrigir é decisão de quem lê.

Esforço: **P** (uma tela / poucas linhas) · **M** (um padrão repetido) · **G** (decisão de design)

## Iteração 1 — 2026-08-28

### 1. Separar "accent decorativo" de "accent de texto" — G
- **Tela:** todas as públicas (26 usos do eyebrow + badges)
- **Problema:** `--brand-accent` foi desenhado para filete, ícone e borda, onde 3:1 basta, mas está aplicado a texto de 10–13px, onde o mínimo é 4.5:1. Em 4 dos 5 temas ele não passa sobre nenhum fundo do site.
- **Sugestão:** em vez de escurecer os cinco accents (o que muda a identidade aprovada), criar um `accent-ink` por tema, escurecido até 4.5:1 sobre `surface`. O accent atual segue nos elementos decorativos.
- **Depende de:** decisão sobre identidade visual dos 5 cartórios.

### 2. `--palette-faint` só como não-texto — G
- **Tela:** área pública (56 usos de `text-brand-faint`) e painel (~40 arquivos com `text-admin-faint`)
- **Problema:** o token não atinge 4.5:1 em nenhum fundo existente — 3.20 sobre branco, 2.88 sobre `surface`, 2.62 sobre `accent-soft`.
- **Sugestão:** decidir se esse terceiro nível de hierarquia existe mesmo. Boa parte desses textos caberia em `text-brand-muted`, que já existe e passa (5.11:1 sobre `accent-soft`).

### 3. Estender `check:a11y` aos 5 temas e ao painel logado — M
- **Tela:** o próprio gate
- **Problema:** hoje varre só `marinho.localhost` (tema verde-dourado), que passa por 0.03 de margem. Os outros 4 temas nunca são vistos.
- **Sugestão:** um tenant representativo por tema, mais as telas de `/admin` com o `signIn` que os specs de `e2e/` já usam.

### 4. `/centrais` no desktop: buraco no grid — P
- **Problema:** seções com um card só (Registro Civil, Protesto, Registro de Imóveis, RTDPJ) deixam metade da largura vazia no grid de 2 colunas.
- **Sugestão:** card único ocupando a linha inteira, ou grid que só vira 2 colunas com 2+ cards.

### 5. `/admin/login` no desktop: coluna esquerda vazia — P
- **Problema:** ~300px de vazio entre o logo e o título no painel escuro.
- **Sugestão:** centrar verticalmente o bloco de texto.

### 6. Aviso de cookies cobre o conteúdo no mobile — M
- **Tela:** todas as públicas em 390px; na `/lgpd` chega a esconder o campo "Nome completo"
- **Problema:** ocupa a área de conteúdo e permanece até o clique.
- **Sugestão:** reduzir a altura no mobile ou ancorar como faixa no rodapé.

### 7. Foco perdido depois de "Entendi" — P
- **Problema:** o `router.refresh()` derruba o foco no `<body>`; quem navega por teclado recomeça a tabulação sem saber onde está.
- **Sugestão:** devolver o foco a um ponto previsível (o `<h1>` da página ou o primeiro link do header).

### 8. Menu mobile: `Escape` e clique fora não fecham — P
- **Tela:** todas as públicas em mobile
- **Problema:** limitação nativa do `<details>`, não regressão. Fechar ao navegar já foi corrigido na iteração 1; estes dois continuam.
- **Sugestão:** trocar o painel por `popover` + `popovertarget` — light dismiss e Escape saem de graça, sem JS extra, reaproveitando o componente que já fecha na navegação.
