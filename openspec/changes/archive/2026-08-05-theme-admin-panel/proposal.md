## Why

O painel admin hoje é deliberadamente "estética fixa da plataforma": os tokens `--palette-admin-*`
são desacoplados de `--brand-*` mesmo quando, por coincidência, reproduzem o verde-dourado do
tenant piloto. Essa decisão está documentada em `openspec/changes/add-admin-visual-identity/design.md`
e reafirmada em `openspec/config.yaml` como característica do produto — e já foi implementada: a
aba Identidade Visual só renderiza `--brand-*` dentro da caixa da prévia ao vivo, nunca no painel
ao redor.

O pedido agora é o oposto: quem administra uma serventia deve abrir o próprio painel e reconhecer a
identidade visual que escolheu — o mesmo estilo que aparece no site público. Hoje uma serventia com
tema Vinho & Pérola loga num painel verde-dourado sem relação nenhuma com a marca que ela mesma
configurou; é a mesma dissonância que a aba Identidade Visual foi criada para eliminar do site
público, só que ainda presente na única tela que quem administra vê todos os dias.

Esta proposta reverte a decisão "painel fixo": o painel passa a herdar `--brand-*` do tenant, do
mesmo jeito que o site público já faz.

## What Changes

- **BREAKING (decisão de produto)**: revoga o não-objetivo "painel tematizado" de
  `add-admin-visual-identity` e o texto correspondente em `openspec/config.yaml`. O painel deixa de
  usar `--palette-admin-*` fixo e passa a resolver as mesmas variáveis `--color-brand-*` que o site
  público, via `data-theme={tenant.theme}` aplicado no layout autenticado do painel.
- **`data-theme` uma vez, na raiz do painel**: `src/app/admin/layout.tsx` já envolve login,
  redefinir-senha e dashboard; passa a chamar `getTenant()` e aplicar `data-theme={tenant.theme}`
  no wrapper. Uma chamada, um lugar — as páginas que já chamam `getTenant()` para nome/selo/logo
  continuam chamando, sem mudança.
- **Nenhuma troca de classe nos 12 arquivos do painel.** `bg-admin-primary`, `text-admin-muted` etc.
  continuam exatamente como estão escritos. O que muda é só a definição, em
  `src/app/globals.css`, de para onde cada `--color-admin-*` aponta: os tokens de identidade
  (primary, primary-soft, accent, on-dark-accent, surface, card-surface, border, active-border,
  muted) passam de `var(--palette-admin-*)` fixo para `var(--brand-*)`, a mesma variável que o
  `[data-theme]` da raiz já resolve para o site público. Os tokens de estado (erro, aviso, sucesso,
  campo, somente-leitura) continuam apontando para `--palette-admin-*` fixo — ver design.md para o
  corte exato.
- **Fonte serifada por tenant no painel**: o mesmo `src/app/admin/layout.tsx` troca a única
  `Spectral` carregada para todo painel pelo mapa `SERIF` já extraído em `src/lib/fonts.ts` (criado
  por `add-admin-visual-identity` para a prévia), selecionando a fonte pelo `tenant.theme` — mesma
  fonte que o site público usa para aquele estilo.
- **A prévia ao vivo da aba Identidade Visual não muda de comportamento.** Ela já renderiza
  `--brand-*` dentro de uma caixa `data-theme`; a diferença é que agora o painel ao redor da própria
  caixa também está em `data-theme`, então a prévia deixa de ser uma ilha visual dissonante do resto
  da tela.
- **`openspec/config.yaml`**: atualizar o parágrafo de contexto do projeto — "painel admin (estética
  da plataforma, fixa, nunca tematizável por cartório)" deixa de ser verdade e precisa refletir a
  nova realidade, para não induzir a erro a próxima proposta que ler esse contexto.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-visual-identity`: o requisito "o painel nunca renderiza `--brand-*` fora da caixa da
  prévia" é revogado; o painel autenticado inteiro passa a renderizar `--brand-*` do tenant da
  sessão.
- `admin-auth`: **adicionado após a implementação inicial**, ao descobrir durante o archive de
  `redesign-admin-login-auth` que o requisito "Tela de login com identidade da serventia" também
  afirmava painel fixo, com cenário próprio ("Duas serventias, mesma estética") não coberto pelo
  delta original desta mudança. `/admin/login` já herda `data-theme` desde a implementação (é a
  raiz de `src/app/admin/layout.tsx`); este delta só atualiza a spec para não contradizer o
  comportamento já implementado.
- `public-site-foundation`: **adicionado pela mesma razão**, ao arquivar `redesign-home-and-service-request`
  e encontrar o requisito "Admin fora do tema do tenant" ("SHALL NOT herdar o tema... estética
  fixa"), terceira spec a afirmar o painel fixo. Mesmo ajuste: a spec passa a refletir o
  `data-theme` que o painel já aplica na raiz.

## Não-objetivos

- **Seletor de tema dentro do painel.** O painel continua herdando o `theme` que a própria
  serventia já escolheu na aba Identidade Visual — não ganha um controle próprio nem diverge do
  site público.
- **Tematizar o painel de outra serventia.** `getTenant()` já resolve pelo domínio da sessão; nada
  nesta mudança toca isolamento entre tenants.
- **Recolorir estados semânticos (erro, aviso, sucesso, campo somente leitura).** Esses continuam
  em paleta neutra fixa — ver design.md, decisão sobre o corte de quais tokens migram para
  `brand-*` e quais ficam neutros.
- **Mudar o corte de cinco estilos ou adicionar estilo novo.** Continua valendo a regra de
  `check:tokens`: nenhum hex fora de `@theme`.

## Impact

- **Código alterado**: `src/app/admin/layout.tsx` (tenant, `data-theme`, fonte por tema);
  `src/app/globals.css` (realiasing dos tokens de identidade em `--color-admin-*`, remoção dos
  `--palette-admin-*` de identidade que ficam órfãos); `openspec/config.yaml`. Nenhum outro arquivo
  do painel precisa de edição — é o ponto central de `add-admin-visual-identity` que faz esta
  mudança compensar: a indireção `--color-admin-*` já existia para isolar componente de paleta.
- **Specs**: delta em `admin-visual-identity` revogando o requisito de painel fixo.
- **Banco**: nenhuma migração — `tenant.theme` já existe e já é lido por `getTenant()`.
- **Dependências**: nenhuma nova.
- **Riscos a vigiar**: contraste — os cinco estilos foram desenhados para o site público (hero
  grande, fundo escuro em blocos); o painel é predominantemente branco/claro com bastante texto
  pequeno em formulário, então o mesmo `--brand-primary` que funciona num botão de hero grande pode
  não ter contraste suficiente num rótulo pequeno em `--brand-card`. Cada um dos cinco estilos
  precisa de checagem de contraste no contexto real do painel (sidebar, formulário, banner), não só
  no contexto da home pública.
- **Testes**: Playwright cobrindo "logar em duas serventias com temas diferentes e ver o painel
  refletir cada uma" (extensão de `e2e/admin-login.spec.ts` ou novo spec), e checagem visual manual
  de contraste nos cinco estilos antes de fechar a mudança.
