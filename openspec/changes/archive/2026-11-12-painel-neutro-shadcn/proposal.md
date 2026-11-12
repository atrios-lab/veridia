## Why

O painel não tem sistema visual, só telas montadas uma a uma: nas 252 telas de `src/app/admin`
há 1.753 tamanhos de fonte avulsos (`text-[..px]`) em 20 medidas, 20 raios de borda diferentes,
cerca de 100 rótulos em caixa alta com espaçamento próprio, serifada em 118 arquivos e animações
que nunca param. O resultado é um painel que parece gerado, não desenhado, e que muda de cor a
cada cartório sem que isso ajude quem trabalha nele. O painel é ferramenta de trabalho; a
identidade de cada cartório interessa a quem vê de fora.

## What Changes

- **BREAKING** O painel `/admin` deixa de herdar o tema publicado da serventia. Ele passa a ter
  um tema próprio e neutro, igual em todo cartório: destaque no navy da Átrios, letra IBM Plex
  Sans, sem serifada. A serventia aparece só no selo e no nome, na barra lateral e no login.
- Os cinco temas por cartório continuam valendo no site público, nas prévias do site dentro do
  painel (Identidade Visual e Publicações), nos PDFs e nos e-mails que saem para o cidadão.
- O painel ganha uma base única de componentes: shadcn/ui sobre Base UI, com o código dos
  componentes dentro do repositório e o tema da plataforma por cima.
- Escalas fechadas de tamanho de letra, raio de borda e cor. Uma trava no CI impede valor avulso
  novo no painel e só deixa a contagem dos antigos cair.
- O site público e o painel passam a ter cada um a sua raiz de layout e a sua folha de estilo,
  para que o tema de um não vaze para o outro.
- A casca muda de desenho: barra lateral clara com tinta navy e borda, rótulos longos em duas
  linhas, sem moldura flutuante. O conteúdo da navegação e as regras de permissão não mudam.
- As telas migram por etapas (fundação, casca, primitivos, telas) num branch de integração. Cada
  etapa é revisada numa PR para esse branch, e o painel novo chega à `main` numa entrega só,
  quando tudo estiver pronto. Antes disso, só entra na `main` a trava do CI, que não muda nada
  na tela.
- `docs/design-system.md` é reescrito e o contexto do `openspec/config.yaml`, que hoje diz que o
  painel herda o tema do tenant, é corrigido.

## Não-objetivos

- Nenhuma mudança no site público: paletas, serifadas, classes `.btn` e componentes dele ficam
  como estão.
- Nenhuma mudança de regra de negócio, de permissão, de rota ou de banco. Não há migração.
- As três mudanças de regra que o protótipo mostra (contador da navegação só com o que espera
  ação, "Com o cidadão há N dias úteis" e o alerta de prazo crítico no topo da Visão geral) não
  entram aqui. Cada uma precisa de aprovação e de change própria.
- Tema escuro do painel.
- Seletor de tema ou de densidade no painel.
- Troca do desenho dos PDFs e dos e-mails.
- Reescrever fluxo de tela: a migração troca a aparência e os componentes, não a ordem dos
  passos nem o texto das telas.

## Capabilities

### New Capabilities

- `admin-design-system`: tema neutro do painel, escalas fechadas, base única de componentes,
  isolamento entre a folha de estilo do painel e a do site, e a trava no CI que protege as
  escalas.

### Modified Capabilities

- `admin-shell`: a casca deixa de resolver o tema de marca da serventia; passa a usar o tema
  neutro, com o selo para fundo claro.
- `admin-visual-identity`: sai o requisito de que o painel herda o tema; a prévia continua
  tematizada dentro da própria caixa; trocar o estilo não repinta mais o painel.
- `admin-auth`: a tela de login mantém selo, nome e subtítulo da serventia, mas com a aparência
  neutra do painel.
- `public-site-foundation`: o requisito "Admin fora do tema do tenant" volta a dizer o que o
  nome diz.

## Impact

- **Código**: `src/app/layout.tsx` (some como raiz única), `src/app/(public)/layout.tsx` e
  `src/app/admin/layout.tsx` (viram raízes), `src/app/globals.css` (os tokens `--color-admin-*`
  e as classes do painel saem dele ao fim da migração), nova folha de estilo do painel, os 46
  arquivos de `src/app/admin/_components` e as 252 telas de `src/app/admin`.
- **Dependências novas**: `@base-ui/react`, `class-variance-authority`, `clsx`,
  `tailwind-merge`, `lucide-react`, `tw-animate-css`, e sob demanda `react-day-picker`, `cmdk` e
  `@tanstack/react-table`. `sonner` já existe.
- **CI**: novo `pnpm check:admin-scale` em `.github/workflows/verify.yml` e na bateria do
  `CLAUDE.md`.
- **Documentação**: `docs/design-system.md`, `openspec/config.yaml`.
- **Sem impacto**: banco, API, autenticação, permissões, site público, PDFs, e-mails.
- **Changes vizinhas**: `admin-redesign-7a-v2` está com as 26 tarefas feitas e ainda aberta.
  Ela acrescenta requisito a `admin-shell` (atalhos de teclado) sem tocar no requisito que esta
  change modifica, mas deve ser arquivada antes desta para não embaralhar a sincronização.
