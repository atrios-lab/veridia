## Context

Hoje existe uma raiz de layout só (`src/app/layout.tsx`) e uma folha de estilo só
(`src/app/globals.css`, 989 linhas), que serve o site público e o painel. O painel pega o tema
da serventia em `src/app/admin/layout.tsx:24` (`data-theme={tenant.theme}`), e os tokens
`--color-admin-*` são, na maioria, apelidos de `--brand-*`. Botão é classe CSS (`.btn
.btn-admin-primary`, 322 usos no painel), diálogo é `<dialog>` nativo, e não há biblioteca de
componentes.

O que o levantamento achou nas 252 telas de `src/app/admin` (cerca de 51 mil linhas): 1.753
`text-[..px]` em 20 medidas, 20 raios diferentes, cerca de 100 rótulos em caixa alta com
`tracking-[..]`, `font-serif` em 118 arquivos e animações contínuas.

Decisões já tomadas pelo dono do projeto, que este documento não reabre: painel neutro com o
cartório só no selo; shadcn/ui sobre Base UI; destaque no navy da Átrios (`#232a64`); IBM Plex
Sans; barra lateral com tinta navy a 8% e borda; rótulos longos da navegação em duas linhas;
abas sublinhadas. A referência visual é o protótipo no canvas
(https://claude.ai/artifact/1ZwBCote1v9xfRupo5pnqp), pranchas "Visão geral" e "Fila de pedidos".

Restrições do projeto que pesam aqui: nenhum hex fora de `@theme` (`pnpm check:tokens`); texto
visível sem travessão (`pnpm check:dashes`); imports com extensão explícita (`@/lib/x.ts`);
teste é `node --test`, sem suíte de navegador no CI; a CSP já permite estilo inline
(`style-src 'self' 'unsafe-inline'`), que o Base UI usa para posicionar camadas.

## Goals / Non-Goals

**Goals:**

- Um painel com a mesma aparência em todo cartório, com escalas fechadas de letra, raio e cor.
- Uma base única de componentes, com teclado e leitor de tela resolvidos pela biblioteca.
- Estilo do painel e do site sem como vazar de um para o outro.
- Uma trava que impeça a volta ao estado atual depois da migração.
- Migração em fatias pequenas, cada uma publicável sozinha, sem tela quebrada no meio.

**Non-Goals:**

- Mexer no site público, nos PDFs ou nos e-mails.
- Mudar regra de negócio, permissão, rota ou banco.
- Tema escuro, seletor de tema, seletor de densidade.
- As três mudanças de regra do protótipo (contador da navegação, "Com o cidadão há N dias
  úteis", alerta de prazo crítico), que dependem de aprovação e de change própria.

## Decisions

### 1. Duas raízes de layout, uma folha de estilo para cada

`src/app/layout.tsx` deixa de existir. `src/app/(public)/layout.tsx` e
`src/app/admin/layout.tsx` passam a renderizar `<html>` e `<body>` cada um. O site importa
`globals.css`; o painel importa `src/app/admin/admin.css`. O `generateMetadata` que hoje mora na
raiz vai para um auxiliar em `src/lib` usado pelas duas; o painel acrescenta o `noindex` que já
tem.

Por que não um invólucro (`<div class="admin">`) com os tokens dentro, que era a ideia inicial:

- O tema do shadcn redefine `--radius-sm` até `--radius-xl` no `@theme`, e isso muda o que
  `rounded-lg` significa no Tailwind inteiro. O site usa `rounded-2xl` 120 vezes, `rounded-xl`
  80 e `rounded-lg` 19. Numa folha só, o site mudaria de forma sem ninguém pedir.
- Menu, diálogo, seleção e aviso do Base UI são desenhados num portal preso ao `<body>`, fora
  de qualquer invólucro. Token declarado no invólucro não chega neles.
- Com duas folhas, cada uma declara de onde lê classes (`@import "tailwindcss" source(none)`
  mais `@source`), e o CSS do painel deixa de ser baixado por quem visita o site.

Custo aceito: navegar entre o site e o painel passa a ser carga de página inteira (duas raízes
não compartilham estado). Isso só acontece no login e no "Sair".

Não há `not-found.tsx`, `error.tsx` nem `global-error.tsx` em `src/app` hoje, então não existe
tela órfã para realocar. `api/`, `robots.ts` e `sitemap.ts` não dependem de layout.

### 2. Ponte de legado para a migração não quebrar tela

As telas ainda não migradas usam `bg-admin-*`, `text-admin-*`, `.btn-admin-*` e `font-serif`.
Se o painel simplesmente trocasse de folha, elas ficariam sem estilo. Então `admin.css` importa
um `admin-legacy.css` temporário que:

- redeclara os tokens `--color-admin-*` com valores neutros, sem `--brand-*`;
- aponta `--font-brand-serif` para a mesma IBM Plex Sans;
- traz as classes de componente que o painel usa hoje (`.btn`, `.btn-admin-*` e afins).

Efeito: no primeiro PR o painel inteiro já fica neutro e sem serifada, mesmo com as escalas
ainda irregulares. Cada tela migrada para de ler a ponte. O último PR apaga
`admin-legacy.css` e os `--color-admin-*` de `globals.css`.

Alternativa descartada: migrar tudo num PR só. São 252 arquivos; ninguém revisa isso.

### 3. Tokens com os nomes do shadcn, declarados direto no `@theme`

Os nomes seguem o shadcn (`background`, `foreground`, `primary`, `muted`, `border`, `ring`,
`destructive`, `sidebar-*`), para que componente vindo do registro funcione sem edição. Os
valores ficam direto em `@theme` de `admin.css`, sem a camada `:root` que o shadcn usa para
alternar claro e escuro: o painel não tem tema escuro, e assim `check:tokens` continua valendo
sem exceção.

| Token | Valor | Uso |
| --- | --- | --- |
| `background` / `card` / `popover` | `#ffffff` | fundo |
| `foreground` | `#0a0a0a` | texto |
| `muted` | `#f5f5f5` | fundo discreto |
| `muted-foreground` | a definir pelo teste de contraste | texto secundário |
| `border` / `input` | `#e5e5e5` | linhas |
| `primary` / `ring` | `#232a64` | ação principal, foco |
| `primary-foreground` | `#ffffff` | texto sobre navy |
| `destructive` | `#e7000b` | preenchimento de ação destrutiva |
| `destructive-text` | `#c10007` | texto de erro e selo claro |
| `warning` | `#bb4d00` | atenção |
| `success` | `#008236` | concluído |
| `sidebar` | navy a 8% sobre branco | barra lateral |
| `sidebar-accent` | navy a 16% | item ativo |
| `sidebar-border` | navy a 16% sobre `#e5e5e5` | borda da barra |

Três ajustes sobre o padrão do shadcn, cada um com motivo medido:

- `warning` e `success` não existem nele (só `destructive`) e são criados aqui.
- O vermelho padrão `#e7000b` não chega a 4,5:1 como texto sobre selo claro; por isso existe
  `destructive-text`.
- O `muted-foreground` padrão (`#737373`) dá 4,7:1 sobre branco, mas 4,3:1 sobre `muted`
  (`#f5f5f5`) e menos ainda sobre a tinta da barra lateral. O valor final sai do teste da
  decisão 6; o ponto de partida é `#6b6b6b` (4,9:1 sobre `muted`). Título de grupo da barra
  lateral usa `#535862`.

Escalas:

- **Letra**: a escala padrão do Tailwind, seis degraus: `text-xs` 12, `text-sm` 14, `text-base`
  16, `text-lg` 18, `text-xl` 20, `text-2xl` 24. Corpo em `text-sm`. A folha de tokens da
  Versão A tinha um degrau de 13; ele cai, porque todo componente do shadcn já vem em
  `text-sm` e `text-xs` e brigar com isso é manter remendo.
- **Raio**: `--radius: 0.5rem`, do qual saem `rounded-sm` 4, `rounded-md` 6, `rounded-lg` 8 e
  `rounded-xl` 12.
- **Peso**: 400, 500 e 600. Número de protocolo, data e valor em coluna usam algarismo tabular.

### 4. Componentes em `src/app/admin/_ui`

O `components.json` aponta os apelidos para `src/app/admin/_ui` (componentes) e
`src/app/admin/_ui/cn.ts` (utilitário). A pasta fica dentro de `admin` de propósito: a regra
"shadcn só no painel" vira caminho de arquivo, e uma regra de import restrito no Biome impede
`src/app/(public)` de importar dali.

O código gerado pelo CLI entra no repositório e passa a ser nosso: imports ajustados para a
extensão explícita do projeto, hex nenhum, texto em português. Versões de `@base-ui/react` e
das demais dependências ficam fixas no `package.json`.

Alternativa descartada: Untitled UI React. Foi comparada lado a lado no canvas e o dono do
projeto escolheu shadcn sobre Base UI.

### 5. O que troca o quê

| Hoje | Passa a ser |
| --- | --- |
| `.btn .btn-admin-*` | `Button` |
| `<dialog>` em `dialog.tsx` e `confirm-action.tsx` | `Dialog` e `AlertDialog` |
| `dropdown.tsx`, `menu-popover.tsx` (no painel) | `DropdownMenu`, `Popover` |
| `checkbox.tsx`, campos soltos | `Checkbox`, `Input`, `Select`, `Textarea`, `Field` |
| `sidebar.tsx`, `sidebar-nav.tsx`, `locked-sidebar.tsx` | `Sidebar` |
| abas e tabelas feitas à mão | `Tabs` (sublinhadas), `Table` |
| selos e avisos feitos à mão | `Badge`, `Alert` |
| `sonner` com classes do painel | `sonner` com o tema novo |
| `global-search.tsx` | `Command` dentro de `Dialog` |
| `AdminIcon` | `lucide-react` |

Escolhas que fogem do padrão do shadcn:

- **Barra lateral** com borda, não a variante "inset". Rótulo longo quebra em duas linhas; o
  componente original corta com reticências, e "Solicitação de papéis de segurança" não cabe
  numa linha.
- **Campo de data** continua sendo `<input type="date">` com a aparência do `Input`. O
  `react-day-picker` é pior para digitar data em pt-BR, e quem lança pedido no balcão digita.
  `Calendar` entra só onde a tela precisa mostrar um calendário (Agenda).
- **Ícones**: os componentes do shadcn importam `lucide-react` por dentro. Manter o `AdminIcon`
  ao lado daria dois traços diferentes na mesma tela, então o painel termina só com lucide.
  `AdminIcon` some quando a última tela que o usa migrar.
- **Movimento**: animação só de entrada e saída (`tw-animate-css`), respeitando
  `prefers-reduced-motion`. As contínuas (`brand-glow`, `attention-pulse` e parecidas) saem do
  painel. O aviso sonoro e o conteúdo dos alertas não mudam.

`src/app/_components` continua compartilhado para o que não é visual (`chat-sound.ts`,
`shake.ts`, `use-live-version.ts`). `document-name-field.tsx` ganha versão do painel na etapa
de telas; o site segue com a atual.

### 6. Trava no CI com linha de base que só desce

`scripts/check-admin-scale.ts`, rodado como `pnpm check:admin-scale`, conta em cada arquivo `.ts`
e `.tsx` de `src/app/admin` (fora os testes) as ocorrências de `text-[`, `rounded-[` (inclusive
os de um lado só, como `rounded-t-[`), `tracking-[` e `font-serif`,
e compara com `scripts/admin-scale-baseline.json`:

- arquivo novo, ou fora da linha de base, com qualquer ocorrência: falha;
- arquivo com mais ocorrências do que a linha de base: falha;
- arquivo com menos: passa e avisa para rodar `--update`, que regrava a linha de base e nunca
  aumenta número.

Ficam de fora, por lista explícita, as duas prévias que desenham o site dentro do painel
(`configuracoes/identidade-visual/preview.tsx` e `publicacoes/_components/preview.tsx`) e o
seletor de estilo (`visual-identity-form.tsx`), que precisam do tema e da serifada da
serventia.

No último PR a linha de base chega a zero, o arquivo é apagado e a trava vira absoluta.

Por que linha de base e não proibição direta: a linha de base inicial tem 2.603 ocorrências em
206 arquivos. Proibir de cara obriga a
desligar a trava no primeiro dia, que é o destino de toda trava que nasce vermelha.

A lógica de contagem e de comparação fica numa função pura com teste em `node --test`. No
mesmo PR entra um teste que lê os valores de `admin.css` e confere 4,5:1 nos pares de texto e
fundo que o painel usa (inclusive sobre `muted` e sobre a tinta da barra lateral).

### 7. Onde a marca do cartório continua

- Selo e nome na barra lateral e nas telas de acesso. A barra é clara, então o selo passa de
  `logos.seal.dark` para `logos.seal.light`.
- Prévias de Identidade Visual e de Publicações: continuam com `data-theme` e a serifada da
  serventia dentro da própria caixa, porque mostram o site.
- PDFs e e-mails: saem para o cidadão e seguem com a marca do cartório. `palette.ts` e o teste
  que o compara ao `@theme` de `globals.css` não mudam.

## Risks / Trade-offs

- [Selo desenhado para fundo escuro ficar ilegível sobre a barra clara] → conferir
  `logos.seal.light` de cada serventia cadastrada antes do PR da casca; se algum não servir, o
  PR espera o arquivo novo.
- [Tela não migrada ficar estranha durante a migração: cores novas com medidas antigas] → só
  acontece no branch de integração e no Preview dele; a produção não vê o meio do caminho. A
  ponte de legado garante que nada quebra enquanto isso.
- [Branch de integração ficar para trás da `main`] → é o maior risco do plano: os 30 commits
  mais recentes da `main` mexeram em `src/app/admin`. Mitigação: trazer a `main` para o branch
  todo dia, migrar primeiro as telas que mais mudam, e pôr a trava do CI na `main` logo no
  começo, para que nenhum valor avulso novo entre por lá enquanto o branch anda.
- [Entrega grande de uma vez] → a PR final tem o tamanho da migração inteira, mas cada pedaço
  já foi revisado na PR da sua etapa; a revisão final é de integração, feita no Preview. As
  serventias são avisadas antes do merge, porque o painel muda todo no mesmo dia.
- [Duas raízes mudarem título, favicon ou cartão social de alguma rota] → o auxiliar de
  metadados é o mesmo código de hoje, e o primeiro PR compara o `<head>` de `/`, de uma página
  interna e de `/admin/login` antes e depois.
- [Carga inteira de página entre site e painel] → só no login e no "Sair"; aceito.
- [Dependências novas no pacote do painel] → entram só na folha e nas rotas do painel; o site
  não as importa, e a regra de import restrito garante isso.
- [`admin-redesign-7a-v2` aberta mexendo na mesma capacidade] → arquivar antes; ela não toca
  no requisito que esta change modifica.
- [Treinamento gravado com o painel antigo] → os vídeos de "Como usar esta tela" vão mostrar a
  aparência anterior. Não bloqueia; regravar entra na lista de pendências da última etapa.
- [Sem teste de navegador no CI, regressão visual passa] → cada PR de tela leva conferência
  manual no host do cartório de demonstração (`demo.localhost`) e no Preview, com captura no
  corpo da PR.

## Migration Plan

O painel novo chega à produção numa entrega só, quando todas as etapas estiverem prontas. O
trabalho corre num branch de integração (`painel-neutro`) criado a partir da `main`:

- cada etapa abaixo é uma PR com destino ao branch de integração, revisada e conferida sozinha;
- o Preview da Vercel do branch de integração mostra o painel novo inteiro, sem tocar a
  produção;
- a `main` é trazida para o branch de integração todo dia, e a linha de base da trava é
  regerada com `--update` depois de cada vinda;
- a única peça que vai direto para a `main`, antes de tudo, é a trava do CI com a linha de base
  (etapa 0), porque não muda nada na tela e impede que a `main` acumule valor avulso novo
  enquanto o branch anda;
- no fim, uma PR do branch de integração para a `main`. Nenhuma etapa toca o banco; desfazer é
  reverter essa PR.

0. **Trava, na `main`**: `check:admin-scale` com a linha de base, teste da função de contagem.
1. **Fundação**: duas raízes, `admin.css` com a ponte de legado, tokens, fonte, `_ui` vazio com
   `components.json`, teste de contraste. No branch de integração, o painel já fica neutro
   daqui.
2. **Casca**: barra lateral, barra do topo, cabeçalho de página, telas de acesso (login,
   esqueci a senha, redefinir, confirmar e-mail, acesso).
3. **Primitivos**: os componentes da tabela da decisão 5 entram em `_ui` e substituem os
   arquivos de `src/app/admin/_components`.
4. **Telas**, uma PR por área: Visão geral; Pedidos (fila e detalhe); Agenda; Atendimento e
   Mensagens; Ouvidoria e LGPD; Publicações e Transparência; Configurações, Usuários e Minha
   conta; Auditoria, Adequação, Utilitários, Átrios, Ajuda e Documento.
5. **Fechamento**: apaga a ponte de legado, os `--color-admin-*`, o `AdminIcon` e a linha de
   base; reescreve `docs/design-system.md`; corrige `openspec/config.yaml`.
6. **Entrega**: conferência do painel inteiro no Preview, aviso às serventias, PR do branch de
   integração para a `main`, arquivamento da change.

## Open Questions

- As prévias dentro do painel continuam tematizadas e os PDFs e e-mails continuam com a marca
  do cartório. É o que este documento assume (decisão 7), mas ainda não foi confirmado pelo
  dono do projeto.
- A folha de tokens da versão shadcn não existe no canvas. Vale desenhá-la antes da etapa 1,
  para o valor de `muted-foreground` e a escala de letra serem aprovados olhando, não lendo.
- As três mudanças de regra do protótipo ficam fora. Se forem aprovadas antes da etapa de
  telas, convém que a change delas entre antes da PR da Visão geral, para a tela não ser
  refeita duas vezes.
