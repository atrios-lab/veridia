## Context

`src/app/globals.css` já separa, para cada componente do painel, o valor bruto
(`--palette-admin-X`) do alias que o Tailwind resolve (`--color-admin-X: var(--palette-admin-X)`).
Essa indireção existia para deixar explícito "isto é fixo, não seria `--brand-*` por acidente" — o
comentário no arquivo hoje diz literalmente "repainting a tenant's palette must never repaint the
admin panel". Esta mudança usa a mesma indireção ao contrário: repontar o alias para `--brand-*`
sem tocar nenhum componente. Nenhum arquivo `.tsx` do painel muda de classe.

`getTenant()` já resolve o tenant da sessão (por domínio) em três lugares independentes:
`admin/(dashboard)/layout.tsx`, `admin/login/page.tsx` e `admin/redefinir-senha/page.tsx`. Nenhum
deles hoje aplica `data-theme`. `src/app/admin/layout.tsx` é o layout raiz de todos os três e hoje
só carrega uma fonte serifada fixa (`Spectral`) — é o único lugar que precisa aprender a olhar o
tenant.

`src/lib/fonts.ts` (extraído por `add-admin-visual-identity`) já expõe `SERIF: Record<Theme, {
variable, className }>` com as cinco `next/font` do site público. O painel reaproveita o mesmo mapa
em vez de carregar uma sexta fonte.

## Goals / Non-Goals

**Goals:**

- O painel autenticado (login, dashboard, configurações, redefinir senha) herda `--brand-*` do
  tenant da sessão, na mesma paleta e fonte que o site público daquele tenant já usa.
- Diff mínimo: repontar tokens existentes em `globals.css` e tocar um único layout, não reescrever
  componentes.
- Estados semânticos (erro, aviso, sucesso, campo, somente-leitura) continuam legíveis e
  consistentes entre as cinco serventias — não viram cinco paletas de alerta diferentes.

**Non-Goals:**

- Seletor de tema dentro do painel (não existe; o painel só lê o `theme` que a aba Identidade
  Visual já grava).
- Novo token CSS para cada estado — reaproveita-se o que já existe.
- Auditoria de contraste automatizada (WCAG contrast checker) — fica como checagem manual descrita
  em Riscos.

## Decisions

### 1. Repontar `--color-admin-*`, não renomear classes

Alternativa descartada: trocar `bg-admin-primary` → `bg-brand-primary` nos ~12 arquivos que usam
classes do painel. Funciona, mas é diff maior sem ganho — a classe `admin-primary` já significa "a
cor primária do painel"; o que muda é a origem do valor, não o nome do conceito. Manter o nome
`admin-*` também deixa claro, lendo o componente, que aquele elemento é "cromo do painel", mesmo que
hoje resolva para uma cor de marca — é o painel que decidiu herdar a marca, o componente não sabe
disso e não precisa saber.

### 2. Dois grupos de token: identidade vs. estado

| Grupo | Tokens `--color-admin-*` | Origem antes | Origem depois |
|---|---|---|---|
| Identidade (tematiza) | `primary`, `primary-soft`, `accent`, `on-dark-accent`, `surface`, `card-surface`, `border`, `active-border`, `muted` | `--palette-admin-*` fixo | `--brand-*` do tenant |
| Estado (fixo) | `input-bg`, `input-border`, `readonly-bg`, `error-*`, `warning-*`, `success-*`, `card`, `text`, `faint`, `on-dark-subtitle`, `on-dark-muted` | `--palette-admin-*` fixo | inalterado |

Critério do corte: um token entra em "identidade" se a cor dele hoje só existe para parecer com a
paleta do tenant piloto (é exatamente isso que o comentário em `globals.css` documentava como
coincidência deliberada). Um token fica em "estado" se a cor comunica um significado que precisa
ser igual em toda serventia — erro é sempre a mesma cor de erro, campo somente-leitura é sempre a
mesma textura, senão a pessoa que administra duas serventias reaprende o painel a cada troca.
`active-border` entra em identidade porque hoje já é descrito como "tingido para o verde do painel"
— o papel dele é reforçar a cor primária, não sinalizar um estado universal.

`--color-admin-card` fica em "estado", não "identidade": é branco em todo lugar hoje
(`--palette-admin-card: #ffffff`, igual a `--palette-card` global), e branco é o que faz um cartão
ler como superfície elevada em qualquer paleta — tematizar o branco do cartão não muda nada visível
na maioria dos temas e arrisca contraste no resto.

Mapeamento de "identidade" para `--brand-*`:

```
--color-admin-primary:      var(--brand-primary)
--color-admin-primary-soft: var(--brand-primary-soft)
--color-admin-accent:       var(--brand-accent)
--color-admin-on-dark-accent: var(--brand-on-dark-accent)
--color-admin-surface:      var(--brand-tint)
--color-admin-card-surface: var(--brand-surface)
--color-admin-border:       var(--brand-border)
--color-admin-active-border: var(--brand-border)
--color-admin-muted:        var(--brand-muted)
```

`admin-surface` (fundo da página, atrás dos cartões) mapeia para `--brand-tint`, não
`--brand-surface`: no painel de hoje, `admin-surface` (`#eceae3`) é visivelmente mais escuro que
`admin-card-surface` (`#f4f3ee`), e `--brand-tint` é o token do site público mais próximo desse
papel de "fundo de página, não de cartão". `admin-card-surface` (fundo de cartão secundário) mapeia
para `--brand-surface`, que é literalmente o mesmo valor hoje para o tema padrão
(verde-dourado: `#f4f3ee` nos dois). Ambos são hipóteses de melhor-encaixe a confirmar visualmente
por tema na Tarefa de QA — não há garantia de que a hierarquia de dois tons sobreviva igualmente
bem nos cinco estilos, e trocar qual token cada um usa é uma mudança de uma linha se a checagem
visual pedir.

Os `--palette-admin-*` correspondentes aos nove tokens de identidade ficam órfãos e são removidos
de `globals.css` junto com o realiasing — não há razão para manter um valor fixo que nada mais lê.
Os `--palette-admin-*` de estado permanecem exatamente como estão, valor e nome; não há benefício
em renomear o que não muda de comportamento.

### 3. `data-theme` e fonte no layout raiz do painel, não em cada página

`src/app/admin/layout.tsx` passa a ser `async`, chamar `getTenant()` uma vez e:
- aplicar `data-theme={tenant.theme}` no wrapper (o mesmo mecanismo que `[data-theme="..."]` em
  `globals.css` já usa para o site público — nenhuma variável CSS nova);
- trocar a importação fixa de `Spectral` por `SERIF[tenant.theme]` de `src/lib/fonts.ts`, aplicando
  `.variable` e `.className` no lugar do que `spectral.variable` fazia hoje.

Alternativa descartada: aplicar `data-theme` em cada página que já chama `getTenant()`
(`(dashboard)/layout.tsx`, `login/page.tsx`, `redefinir-senha/page.tsx`). Funciona, mas triplica o
ponto de decisão "qual atributo o painel carrega" — layout raiz é o único ancestral comum das três
telas e já existe justamente para isso.

`getTenant()` continua sendo chamado de novo nas páginas-filho que precisam de outros campos do
tenant (nome, selo, logo) — é o mesmo padrão que já existe hoje entre `login/page.tsx` e
`(dashboard)/layout.tsx`, não uma duplicação nova introduzida por esta mudança.

## Risks / Trade-offs

- **Contraste em contexto diferente do que a paleta foi desenhada** → todos os nove tokens de
  identidade já são pares testados no site público (botão sobre cartão claro, texto secundário
  sobre fundo claro), e o painel usa exatamente esse mesmo tipo de par (formulário sobre cartão
  claro) — o risco é menor do que "inventar par novo", mas os cinco estilos não foram
  necessariamente revisados com a densidade de texto pequeno de um formulário administrativo.
  Mitigação: checagem visual manual dos cinco `data-theme` em `/admin` antes de fechar a mudança
  (tarefa dedicada, sem ferramenta nova).
- **`active-border` e `surface`/`card-surface` são heurística, não princípio** → ver Decisão 2;
  mitigado por serem mudanças de uma linha em `globals.css` caso a checagem visual peça outro
  mapeamento.
- **`config.yaml` desatualizado depois desta mudança** → se o parágrafo de contexto não for
  editado, toda proposta futura lida por `openspec instructions` volta a afirmar que o painel é
  fixo. Mitigado por ser um item explícito em tasks.md, não uma nota perdida.

## Migration Plan

Sem dado em banco envolvido — é CSS e um layout de servidor. Deploy único, sem passo de
expand/contract: a troca de `var(--palette-admin-*)` para `var(--brand-*)` e o `data-theme` no
layout entram juntos, e o efeito é só visual, reversível revertendo o commit.

## Open Questions

Nenhuma — o corte de tokens (Decisão 2) e o local do `data-theme` (Decisão 3) resolvem as únicas
ambiguidades da mudança; o que resta é checagem visual, coberta em tasks.md.
