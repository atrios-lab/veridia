## ADDED Requirements

### Requirement: Tema neutro e único do painel

Toda tela sob `/admin` SHALL usar um único tema da plataforma, igual em toda serventia: cor de
destaque navy da Átrios, letra IBM Plex Sans nos pesos 400, 500 e 600, e nenhuma serifada. O
tema NÃO SHALL depender do estilo publicado pela serventia nem ler os tokens de marca
(`--brand-*`). As cores de estado (erro, atenção, sucesso) SHALL ser as mesmas em toda
serventia.

#### Scenario: Duas serventias, um painel

- **WHEN** a mesma tela do painel é aberta no domínio de uma serventia com estilo Vinho & Pérola
  e no de outra com estilo Grafite & Cobre
- **THEN** cores, letra e formas são idênticas nas duas; só o selo e o nome da serventia mudam

#### Scenario: Trocar o estilo do site não muda o painel

- **WHEN** uma serventia publica outro estilo em Identidade Visual
- **THEN** o site público dela muda de paleta e de serifada, e o painel continua como estava

### Requirement: Escalas fechadas de letra, raio e cor

As telas do painel SHALL usar apenas os degraus da escala de letra (12, 14, 16, 18, 20 e 24
px), os degraus da escala de raio (4, 6, 8 e 12 px) e as cores declaradas como token do painel.
Tamanho de letra, raio ou espaçamento entre letras escrito como valor avulso na tela NÃO SHALL
ser aceito em tela nova nem em tela já migrada.

#### Scenario: Valor avulso em tela nova

- **WHEN** um arquivo novo em `src/app/admin` usa `text-[13px]`, `rounded-[10px]`,
  `tracking-[0.08em]` ou `font-serif`
- **THEN** `pnpm check:admin-scale` falha e aponta o arquivo e a ocorrência

#### Scenario: Tela antiga não pode piorar

- **WHEN** um arquivo ainda não migrado ganha mais uma ocorrência de valor avulso do que tinha
  na linha de base
- **THEN** `pnpm check:admin-scale` falha

#### Scenario: Tela migrada baixa a linha de base

- **WHEN** um arquivo passa a ter menos ocorrências do que a linha de base registra
- **THEN** a verificação passa e avisa que a linha de base pode ser reduzida, e a redução nunca
  aumenta o número de arquivo nenhum

#### Scenario: Prévia do site fica de fora

- **WHEN** a verificação encontra as prévias que desenham o site dentro do painel (Identidade
  Visual e Publicações)
- **THEN** elas não são contadas, porque precisam do tema e da serifada da serventia

### Requirement: Contraste mínimo garantido por teste

Todo par de texto e fundo que o tema do painel oferece SHALL ter contraste de pelo menos 4,5:1,
inclusive texto secundário sobre fundo discreto e texto sobre a tinta da barra lateral. A
garantia SHALL ser um teste automático que lê os valores da folha de estilo do painel, não uma
conferência manual.

#### Scenario: Token escurecido demais ou de menos

- **WHEN** alguém altera a cor de texto secundário para um valor que dá menos de 4,5:1 sobre o
  fundo discreto
- **THEN** `pnpm test` falha e diz qual par não passou e qual contraste ele dá

### Requirement: Base única de componentes do painel

Os controles do painel SHALL vir de uma única base de componentes mantida em
`src/app/admin/_ui`: botão, campo, seleção, caixa de marcação, diálogo, confirmação, menu, aba,
tabela, selo, aviso e notificação. Todo componente interativo SHALL ser operável só pelo teclado e SHALL
mostrar foco visível. O site público NÃO SHALL importar dessa pasta.

#### Scenario: Diálogo operável pelo teclado

- **WHEN** um diálogo de confirmação é aberto no painel
- **THEN** o foco entra no diálogo, `Tab` circula só pelos controles dele, `Esc` fecha, e ao
  fechar o foco volta ao controle que o abriu

#### Scenario: Site não importa do painel

- **WHEN** um arquivo de `src/app/(public)` importa algo de `src/app/admin/_ui`
- **THEN** `pnpm lint` falha

### Requirement: Estilo do painel isolado do estilo do site

O painel e o site público SHALL ter cada um a sua raiz de layout e a sua folha de estilo. Um
token ou uma escala declarada para o painel NÃO SHALL alterar a aparência de nenhuma página do
site, e o inverso também vale.

#### Scenario: Raio do painel não muda o site

- **WHEN** a escala de raio do painel é declarada
- **THEN** os elementos do site público continuam com os raios que tinham antes

#### Scenario: Visitante não baixa o estilo do painel

- **WHEN** um visitante abre a home do site público
- **THEN** a página não carrega a folha de estilo do painel

#### Scenario: Metadados do site preservados

- **WHEN** a home, uma página interna do site e `/admin/login` são abertas depois da separação
  das raízes
- **THEN** título, descrição, canônico, favicon e cartão social de cada uma são os mesmos de
  antes, e as rotas do painel continuam com `noindex`

### Requirement: Movimento só com função

O painel SHALL animar apenas entrada e saída de camadas (diálogo, menu, notificação) e mudança
de estado, e SHALL suprimir essas animações quando o sistema pedir movimento reduzido. Animação
contínua de enfeite NÃO SHALL existir no painel.

#### Scenario: Movimento reduzido

- **WHEN** o sistema operacional do usuário está com movimento reduzido ligado e um diálogo abre
- **THEN** o diálogo aparece sem animação

#### Scenario: Nada pulsa parado

- **WHEN** uma tela do painel está aberta sem nenhuma ação do usuário e sem evento novo
- **THEN** nenhum elemento da tela fica animando
