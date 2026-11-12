# Design system

O produto tem duas faces com sistemas visuais separados, de propósito:

- **Painel (`/admin`)**: ferramenta de trabalho. Um tema neutro, igual em todo cartório. O
  cartório aparece só no selo e no nome, na barra lateral e nas telas de acesso.
- **Site público**: o que o cidadão vê. Cada cartório com a sua paleta e a sua serifada,
  escolhidas em Configurações › Identidade visual.

Cada face tem a sua raiz de layout e a sua folha de estilo, e uma não alcança a outra. A decisão
e o porquê estão na change `painel-neutro-shadcn` do OpenSpec.

---

## Painel

### Onde fica cada coisa

| O quê | Onde |
| --- | --- |
| Tokens, escalas, classes nativas e animações | `src/app/admin/admin.css` |
| Componentes (shadcn/ui sobre Base UI, estilo base-vega) | `src/app/admin/_ui/` |
| Junção de classes | `cn` em `src/app/admin/_ui/cn.ts` |
| Ícones | `lucide-react`, direto ou por `AdminIcon` (`_components/icon.tsx`), que mapeia nomes para ícones lucide |
| Casca (barra lateral, topo, cabeçalho de página) | `src/app/admin/_components/` |
| Contraste dos tokens | `src/lib/admin-theme.test.ts` |
| Trava das escalas | `pnpm check:admin-scale` |

Os componentes de `_ui` são código nosso: vieram do registro do shadcn e podem ser editados.
Componente novo entra pelo CLI (`pnpm dlx shadcn@4.23.0 add <nome>`), com o `cn` e os imports
corrigidos para o padrão do projeto (extensão explícita) e os textos em português.

### Tokens

Use sempre o token, nunca a cor. Hex só existe dentro de `@theme` (`pnpm check:tokens`).

| Token (classe) | Uso |
| --- | --- |
| `surface` | Fundo da área de conteúdo, atrás dos cartões (navy a 4%) |
| `background` / `foreground` | Branco dos cartões, campos, menus e topo; texto principal |
| `card` / `card-foreground` | Cartão |
| `muted` | Fundo discreto: faixa de filtro, rodapé de tabela, área somente leitura |
| `muted-foreground` | Texto secundário: descrição, data, legenda |
| `primary` / `primary-foreground` | Navy da Átrios. Ação principal, link, item ativo, destaque cheio |
| `border` | Toda linha e borda de cartão ou tabela |
| `input` | Borda de campo, caixa de marcação, seleção (3:1 contra o fundo) |
| `ring` | Anel de foco |
| `destructive` / `destructive-foreground` / `destructive-soft` | Erro, exclusão, prazo vencido |
| `warning` / `warning-foreground` / `warning-text` / `warning-soft` | Atenção, prazo perto, exigência |
| `success` / `success-foreground` / `success-text` / `success-soft` | Concluído, pago, disponível |
| `holder` / `holder-foreground` / `holder-soft` | Só a agenda do Tabelião, ao lado da Geral em navy |
| `sidebar-*` | Só a barra lateral |
| `msg-*` | Só Mensagens internas (cor que cada pessoa escolhe) |

Regras de cor:

- **Destaque é cor cheia, não tinta.** Faixa, separador, selo que precisa ser visto: fundo
  sólido (`bg-primary`, `bg-warning`, `bg-destructive`, `bg-success`) com o texto
  `*-foreground`. A versão `*-soft` é para caixa de aviso com texto `*-text` em cima.
- Estado nunca só pela cor: sempre com texto ou ícone junto.
- Texto sobre `muted` ou sobre a barra lateral usa `foreground` ou `muted-foreground`; os dois
  passam 4,5:1 ali (o teste confere).

### Escalas

**Letra** (só estas):

| Classe | Tamanho | Uso |
| --- | --- | --- |
| `text-xs` | 12px | Legenda, selo, rótulo de coluna, contador |
| `text-sm` | 14px | **Corpo do painel.** Tabela, formulário, botão, descrição |
| `text-base` | 16px | Texto corrido longo (mensagem do cidadão, termo) |
| `text-lg` | 18px | Título de cartão ou seção |
| `text-xl` | 20px | Subtítulo de tela, título de diálogo grande |
| `text-2xl` | 24px | Título da tela (`AdminPageHeader`) |
| `text-3xl` | 30px | Só número de indicador (KPI) |

**Peso**: `font-normal` (400), `font-medium` (500) e `font-semibold` (600). A IBM Plex Sans
está carregada só nesses três; `font-bold` e acima viram `font-semibold`.

**Raio**: `rounded-sm` (4px), `rounded-md` (6px, campo e botão), `rounded-lg` (8px), `rounded-xl`
(12px, cartão e diálogo), `rounded-full` (pílula, avatar, contador).

**Espaço**: a escala do Tailwind (múltiplos de 4px). Margem da tela: `px-4 md:px-8`, a mesma do
`AdminPageHeader`. Entre blocos de uma tela: `gap-6` ou `space-y-6`. Dentro de cartão: `p-4`
ou `p-6`.

**Proibido no painel** (a trava falha o CI): `text-[…]`, `rounded-[…]`, `tracking-[…]` e
`font-serif`. Também evite: `uppercase` com espaçamento em rótulo (o "sobretítulo" em caixa
alta saiu do painel; use frase normal em `text-xs font-medium text-muted-foreground`),
`shadow-[…]` (use `shadow-xs` a `shadow-lg`) e `leading-[…]` (use `leading-tight`, `snug`,
`normal`, `relaxed`).

A trava é absoluta: todo arquivo do painel tem de estar em zero. Ela nasceu com uma linha de
base de 2.603 ocorrências, que só podia descer, e chegou a zero com a migração.

Exceção: as duas prévias do site dentro do painel (Identidade visual e Publicações) e o seletor
de estilo desenham o site do cartório e usam a paleta e a serifada dele.

### Componentes

| Precisa de | Use |
| --- | --- |
| Botão | `Button` (`_ui/button.tsx`). Link com cara de botão: `buttonVariants()` no `<Link>` |
| Botão de envio de server action | `SubmitButton` (`_components/submit-button.tsx`), que desabilita e diz a espera |
| Campo de texto | `Input`, `Textarea` |
| Rótulo, ajuda e erro de campo | `Field`, `FieldLabel`, `FieldDescription`, `FieldError` (`_ui/field.tsx`) ou `Label` |
| Seleção dentro de formulário de server action | `NativeSelect` (`_ui/native-select.tsx`) |
| Seleção com busca ou rica | `Select` |
| Caixa de marcação em formulário | `<input type="checkbox" className="checkbox-admin">` ou `Checkbox` |
| Opção única | `RadioGroup` |
| Liga/desliga | `Switch` |
| Confirmação de ação destrutiva | `ConfirmAction` (`_components/confirm-action.tsx`) |
| Diálogo | `AdminDialog` (`_components/dialog.tsx`, `<dialog>` nativo) ou `Dialog` |
| Menu de ações | `DropdownMenu` |
| Abas | `Tabs` (`variant="line"`: sublinhadas, nunca pílula) |
| Tabela | `Table` e família |
| Selo de estado | `Badge` |
| Aviso dentro da tela | `Alert` |
| Cartão | `Card` e família, ou `div` com `rounded-xl border bg-card` |
| Linha de lista clicável | `Item` |
| Lista vazia | `Empty` |
| Carregando | `Spinner`, `Skeleton` |
| Progresso | `Progress` |
| Tecla de atalho | `Kbd` |
| Dica ao passar o mouse | `Tooltip` |

Variantes do `Button`:

| Variante | Quando |
| --- | --- |
| `default` | A ação principal da tela. **Uma por tela.** |
| `outline` | Ação alternativa, cancelar, voltar |
| `secondary` | Ação de apoio sem borda, numa faixa cinza |
| `ghost` | Ação discreta dentro de linha ou cartão |
| `link` | Ação em texto |
| `destructive` | Gatilho de ação destrutiva numa fileira (fundo vermelho claro) |
| `destructive-solid` | Só o botão que confirma, dentro do diálogo |

Tamanhos: `sm` (32px, linha densa), padrão (36px), `lg` (40px, envio de formulário), e
`icon`, `icon-sm`, `icon-xs` para botão só de ícone (sempre com `aria-label`).

### Padrões de tela

- **Título**: sempre `AdminPageHeader`. Nada de título próprio na tela.
- **Corpo**: `<main>` com `px-4 pb-8 md:px-8` e `space-y-6`, largura livre ou `max-w-*` da
  escala.
- **Seção**: título `text-lg font-semibold`, descrição `text-sm text-muted-foreground`.
- **Cartão**: borda (`border`), fundo `bg-card`, `rounded-xl`, sem sombra pesada (no máximo
  `shadow-xs`). Cartão dentro de cartão não: use divisória (`divide-y`) ou `bg-muted/50`.
- **Tabela**: cabeçalho `text-xs font-medium text-muted-foreground`, linhas `text-sm`, número e
  data com `tabular-nums`, rodapé de paginação em `bg-muted/50`.
- **Formulário**: rótulo visível acima do campo, ajuda abaixo, erro abaixo do campo em
  `text-destructive`. Envio à direita no computador, largura cheia no celular.
- **Aviso**: `Alert` ou caixa `rounded-lg border bg-*-soft text-*-text p-4`.

### Tema escuro

O botão de sol e lua no topo troca entre o tema claro e o escuro. A escolha fica no cookie
`painel_tema`, que o layout raiz lê para já entregar a página no tema certo. Cada token do tema
claro tem o seu valor escuro em `--palette-dark-*` (`admin.css`), trocado sob a classe `.dark`
no `<html>`. O teste de contraste confere os dois temas e falha se um token claro ficar sem
valor escuro.

No escuro, o destaque é um anil claro (`#8f9af2`): o navy da Átrios some sobre fundo escuro.
Cor fixa (`bg-white`, `text-black`) não acompanha o tema; use sempre o token. Tela nova precisa
ser vista nos dois temas.

### Movimento

Entrada e saída de camada (diálogo, menu, aviso) e mudança de estado. O que tem pendência na
Visão geral pisca e o item "Treinamento" pulsa enquanto houver o que fazer, por decisão do dono
do projeto: `animate-number-blink`, `animate-row-glow`, `animate-attention-pulse` e
`animate-attention-pulse-light`, sempre atrás de `motion-safe:`. Animação de enfeite, sem
relação com estado, não entra.

### Confirmar e registrar ação destrutiva

Toda ação que remove, invalida ou tira do ar passa por duas coisas:

1. **Confirmar com `ConfirmAction`.** O gatilho abre um diálogo com a pergunta, a consequência,
   o botão que confirma (`destructive-solid`) e o "Voltar". O "Voltar" vem primeiro no DOM, para
   receber o foco. O erro aparece dentro do diálogo, que só fecha por `Escape` ou "Voltar". O
   gatilho nomeia a ação ("Excluir protocolo") e o botão do diálogo confirma ("Confirmar
   exclusão"). Nunca `confirm()` nativo: o navegador oferece bloqueá-lo e ele passa a devolver
   `false` para sempre.
2. **Registrar com `recordAudit`** na função de dados, não na server action. `pnpm
   check:destructive` falha se um `.delete(` aparecer sem ele.

---

## Site público

O site usa `src/app/globals.css`, que importa `src/app/brand.css` (botões, diálogos, menus,
movimento e a camada base), que por sua vez importa `src/app/brand-palettes.css` (as cinco
paletas, os tokens `--color-brand-*` e a serifada de cada estilo). O painel importa só
`brand-palettes.css`, para as prévias do site.

### Botões

Sempre três classes, nessa ordem: `btn`, a variante e o tamanho.

```tsx
<button type="submit" className="btn btn-primary btn-lg">Enviar</button>
```

| Variante | Quando |
| --- | --- |
| `btn-primary` | A ação principal. Uma por tela |
| `btn-secondary` | Ação alternativa, cancelar, voltar |
| `btn-danger` | Ação destrutiva |
| `btn-ghost` | Ação em texto, sem caixa |

| Tamanho | Onde |
| --- | --- |
| `btn-sm` | Barra de navegação |
| `btn-md` | Barra de navegação |
| `btn-lg` | Toda ação dentro do conteúdo, inclusive a secundária: é a faixa que passa dos 44px de alvo de toque |

Um raio só, `--radius-control` (10px). Exceção: o botão flutuante do chat é `rounded-full`.

### Cursor e foco

Em `@layer base`, com `:where()` (especificidade zero), todo `button`, `a[href]` e
`[role="button"]` ganha cursor de mão e anel de foco visível, e todo campo ganha o anel junto à
borda. É a rede de segurança para que nenhum botão nasça sem foco por esquecimento. O painel tem
a mesma regra, no navy, em `admin.css`.
