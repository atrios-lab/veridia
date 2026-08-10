# Design system — botões

Todo botão do produto — painel e site — sai das mesmas classes, declaradas em
`src/app/globals.css`. Não existe componente React de botão: a marcação continua sendo
`<button>`, `<a>` ou `<Link>`, e o que muda é a string de `className`.

## Como se escreve um botão

```tsx
<button type="submit" className="btn btn-admin-primary btn-md">Salvar</button>
```

Sempre três partes, nessa ordem:

| Parte | O que decide | Obrigatória |
| --- | --- | --- |
| `btn` | A forma: raio, peso, gap, transição, estado desabilitado | sim |
| `btn-{variante}` | O preenchimento e a cor | sim |
| `btn-{sm\|md\|lg}` | O tamanho | sim |

Classes de **layout** (`flex-1`, `w-full`, `shrink-0`, `mt-3`, `md:w-auto`) vêm depois e
continuam livres. Classes de **aparência** — `rounded-*`, `bg-*`, `text-[13px]`, `px-*`,
`hover:*`, `focus-visible:*` — não. Se você está escrevendo uma delas em um botão, ou o
caso pede uma variante nova aqui, ou não é um botão.

## As variantes

Duas famílias porque o painel e o site leem vocabulários de token diferentes
(`--color-admin-*` e `--color-brand-*`), não porque a forma mude. A forma é a mesma.

| Site público | Painel admin | Quando |
| --- | --- | --- |
| `btn-primary` | `btn-admin-primary` | A ação principal da tela. **Uma por tela.** |
| `btn-secondary` | `btn-admin-secondary` | Ação alternativa, cancelar, voltar |
| `btn-danger` | `btn-admin-danger` | Gatilho de ação destrutiva: excluir, cancelar pedido |
| (só painel) | `btn-admin-danger-solid` | Só o botão que confirma, dentro do diálogo |
| `btn-ghost` | `btn-admin-ghost` | Ação em texto, sem caixa ("Trocar arquivo", "Baixar") |

## Os tamanhos

| Classe | Padding / texto | Onde |
| --- | --- | --- |
| `btn-sm` | 6px 12px · 12px | Ação dentro de uma linha densa da tabela ou de um card |
| `btn-md` | 8px 16px · 13px | Padrão do painel |
| `btn-lg` | 14px 24px · 15px | Submit de formulário e **toda ação do site público no conteúdo** |

No site público, ação dentro do conteúdo é `btn-lg` mesmo quando é secundária: é a única faixa
que passa dos 44px de alvo de toque, e ali o dedo é o ponteiro. `btn-sm` e `btn-md` são para
mouse — ou seja, para o painel e para a barra de navegação.

## O raio

Um só, `--radius-control` (10px). Antes desta camada existiam doze valores diferentes de
`border-radius` entre painel e site, de 8px a 16px, cada tela tendo copiado e mutado a
string da anterior. Não acrescente um treze.

Exceção deliberada: o botão flutuante do chat continua `rounded-full`. É um FAB, não um
botão de formulário.

## As duas exceções sobre fundo escuro

Botão dentro de superfície escura — o card de atendimento do painel e o rodapé da barra
lateral — carrega uma classe de cor a mais (`bg-admin-on-dark-accent`, `hover:text-white`),
porque a cor de hover da variante é escura e sumiria ali. São as únicas duas do produto. Se
aparecer uma terceira, vira variante `on-dark` no CSS em vez de override na tela.

## Cursor e foco: a rede de segurança

Em `@layer base`, com `:where()` (especificidade zero):

```css
:where(button, a[href], [role="button"])       { cursor: pointer; }
:where(button:disabled, [aria-disabled="true"]) { cursor: not-allowed; }
:where(button, a[href], [role="button"], input, select, textarea):focus-visible { … }
```

Vale para todo elemento interativo real, tenha ou não a classe `.btn`. Uma auditoria achou
88 de 92 `<button>` sem nenhum estado de foco visível — invisível com mouse, eliminatório
com teclado. Essa regra existe para que nenhum botão futuro consiga nascer sem foco por
esquecimento.

Especificidade zero significa que o componente ainda ganha quando precisa: o `cursor-not-allowed`
dos dropzones enquanto sobe arquivo continua valendo, sem `!important`.

## Ação destrutiva: confirmar e registrar

Toda ação que remove, invalida ou tira do ar passa por duas coisas, sem exceção.

**1. Confirmar com `<ConfirmAction>`** (`src/app/admin/_components/confirm-action.tsx`). O
gatilho não executa: abre um modal com a pergunta, a consequência em texto, o botão que
confirma e o "Voltar".

O modal é `<AdminDialog>` (`_components/dialog.tsx`), um `<dialog>` nativo aberto com
`showModal()`. Nativo e não uma `div` posicionada porque a top layer, a armadilha de foco,
o `Escape` e o fundo inerte já vêm de graça. São as quatro coisas que um overlay caseiro
tem de reimplementar, e a armadilha de foco é a que ele costuma errar: invisível com mouse,
eliminatória com teclado.

Nunca `confirm()` nativo: depois de alguns diálogos o navegador oferece bloqueá-los para a
aba, e um `confirm()` bloqueado devolve `false` para sempre sem avisar. O botão mais perigoso
do painel simplesmente pararia de funcionar, em silêncio, e o operador continuaria clicando.
Três telas usavam `confirm()` até esta varredura.

A estrutura é a do AlertDialog do shadcn, sem instalar shadcn (o projeto não usa biblioteca de
componente): corpo com título e descrição em tom mudo, um filete, e o rodapé `.dialog-footer`
com as ações à direita: cancelar à esquerda, ação à direita.

Detalhes que não são opcionais:

- **O "Voltar" vem primeiro no DOM.** `showModal()` foca o primeiro elemento focável, então
  quem segura o foco é o botão seguro. A tecla que abre uma confirmação nunca deve ser a
  tecla que a completa. Em tela estreita o rodapé inverte a coluna (`column-reverse`), o que
  põe a ação onde o polegar espera **sem** mexer nessa ordem do DOM.
- **A ação é sólida, o cancelar é contorno.** `.btn-admin-danger` (contorno) é o gatilho, que
  fica numa fileira de controles comuns e não deve gritar. `.btn-admin-danger-solid` é o que
  confirma: branco sobre o vermelho de erro, 7,4:1, acima de AAA.
- **A entrada é `transition` com `@starting-style`, não `@keyframes`.** Um keyframe que começa
  em `opacity: 0` deixa o diálogo invisível se o navegador não avançar a animação, e um
  diálogo de confirmação invisível é um modal que o operador não vê mas que já está com o
  teclado dele. A transição assenta no estado visível e só recua para o escondido na abertura,
  então tudo que der errado, inclusive um navegador sem `@starting-style`, dá errado
  mostrando o diálogo.
- **O erro fica dentro do modal.** Um `<dialog>` modal está na top layer e cobre toast; a
  mensagem tem de estar onde o operador está olhando. Por isso o chamador passa `error`, e
  o modal continua aberto enquanto houver um.
- **Não fecha por clique no fundo.** As saídas são `Escape` e o "Voltar", ambas pelo teclado.
  Um clique perdido ao lado de um diálogo que pergunta se pode excluir não é uma delas.
- **Rótulos distintos.** O gatilho nomeia a ação (`"Excluir protocolo"`), o botão do modal
  confirma (`"Confirmar exclusão"`). O operador precisa saber em qual dos dois está, e o
  teste precisa conseguir distingui-los.

Toda tela modal do painel usa a mesma casca — inclusive as que não são destrutivas
(transferir atendimento, encerrar conversa), que antes eram faixas inline apesar do nome.

**2. Registrar com `recordAudit`**, na função de dados, não na server action. É lá que todos
os painéis passam, e é o único lugar onde esquecer não é possível por descuido de um caller.
`pnpm check:destructive` falha no CI se um `.delete(` aparecer numa função sem `recordAudit` —
escrito enquanto o placar era zero, pela mesma razão do `check-tokens.mjs`.

## O que ficou fora, e por quê

Estes continuam com classe própria. Recebem cursor e foco da camada base, mas não são `.btn`:

- **Botões só de ícone** (fechar modal, olho da senha, remover anexo): a caixa do `.btn` não
  serve para um alvo quadrado. Precisam de `aria-label`, não de variante.
- **Pílulas de alternância e abas** (`chat-toggle`, abas de configurações, filtros de estado,
  seletor de horário): o estado ativo é a informação principal, e `.btn` não tem estado ativo.
- **Cards clicáveis** (`<Link>` que embrulha um cartão inteiro): é uma superfície de navegação
  com layout próprio, não um botão.
- **Links dentro de parágrafo**: sublinhado no fluxo do texto, não `inline-flex`.

## Ao adicionar uma tela

Escolha entre as quatro variantes. Se nenhuma servir, o problema quase sempre é a hierarquia
da tela, não a falta de uma variante. Uma variante nova só entra aqui depois de aparecer em
duas telas diferentes.
