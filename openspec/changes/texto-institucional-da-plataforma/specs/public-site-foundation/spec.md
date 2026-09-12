## MODIFIED Requirements

### Requirement: Shell público com navegação gated
Toda página pública DEVE (SHALL) compartilhar cabeçalho (selo, nome e subtítulo do tenant, navegação)
e rodapé (navegação secundária e texto legal do tenant). Itens de navegação e atalhos DEVEM (SHALL)
aparecer somente quando a seção correspondente está habilitada para o tenant
(`enabledSections`); esconder o item não substitui a checagem de gating no servidor da rota.

O rodapé DEVE (SHALL) identificar o site como a Plataforma Eletrônica Oficial da Serventia, com
a base normativa (art. 208, II, "b", do Código Nacional de Normas do CNJ, Provimento CNJ
n. 180/2024) e a conformidade com a LGPD e o Provimento CNJ n. 213/2026, e DEVE (SHALL) linkar a
página institucional da plataforma no grupo Cidadão, ao lado da política de privacidade. Esse
link NÃO DEVE (SHALL NOT) levar `data-section`: não é uma seção gated.

Toda seção habilitada DEVE (SHALL) ser alcançável a partir do cabeçalho, em qualquer viewport,
sem depender do rodapé. No desktop, a barra é Início, Serviços, Cidadão, Contato e Transparência,
mais o botão de consulta de protocolo; "Serviços" e "Cidadão" abrem um submenu com as páginas do
grupo que a barra não mostra sozinha, cada uma com uma linha dizendo o que ela é. No celular, o
menu lista todas as páginas, agrupadas nos mesmos grupos que o rodapé usa. O cabeçalho NÃO DEVE
(SHALL NOT) provocar rolagem horizontal em nenhum viewport.

A navegação DEVE (SHALL) marcar o link da página em que o visitante está, com `aria-current="page"`
e com destaque visual, e apenas esse. Quando essa página está dentro de um submenu da barra, o
botão do grupo DEVE (SHALL) receber o mesmo destaque e `aria-current="true"`, para a barra dizer
onde o visitante está com o submenu fechado. A marcação DEVE (SHALL) acompanhar navegação feita no
cliente, sem depender de recarregamento. Uma seção que expande em mais de um link (ver
`sectionNavLinks`) DEVE (SHALL) ser marcada pelo endereço aberto, não pela seção inteira. O rodapé
NÃO precisa (SHALL NOT be required to) marcar nada: ali a navegação é atalho, não localização.

#### Scenario: Seção desabilitada some da navegação
- **WHEN** o tenant tem uma seção desabilitada (ex.: `ouvidoria` em `disabledSections`)
- **THEN** nenhum link para essa seção aparece no cabeçalho, rodapé ou blocos da home

#### Scenario: Mobile-first
- **WHEN** qualquer página pública é aberta em viewport 390px
- **THEN** o conteúdo renderiza sem overflow horizontal e com as ações principais acessíveis

#### Scenario: A barra do desktop
- **WHEN** qualquer página pública é aberta em viewport de 1024px ou mais
- **THEN** o cabeçalho mostra, nesta ordem, Início, Serviços, Cidadão, Contato, Transparência e o
  botão de consulta de protocolo, sem quebrar rótulo em duas linhas

#### Scenario: Um grupo abre um submenu
- **WHEN** o visitante, no desktop, abre "Serviços" ou "Cidadão"
- **THEN** vê as páginas habilitadas daquele grupo que a barra não mostra sozinha, cada uma com
  a sua descrição, e nenhuma das que a barra já mostra (ex.: "Transparência" não se repete em
  "Cidadão")

#### Scenario: O rodapé nomeia a plataforma e linka a página
- **WHEN** qualquer página pública é aberta
- **THEN** o rodapé cita a Plataforma Eletrônica Oficial da Serventia com o Provimento CNJ
  n. 180/2024 e traz o link "Sobre a plataforma" no grupo Cidadão, sem `data-section`

## ADDED Requirements

### Requirement: Página institucional da plataforma
O site DEVE (SHALL) oferecer, em `/plataforma`, em todo tenant e fora do gating por seção, uma
página fixa com a identidade do tenant que diga: o que é a plataforma (sistema próprio da
serventia para solicitação e acompanhamento de serviços eletrônicos, art. 208, II, "b", do
Código Nacional de Normas do CNJ, redação do Provimento CNJ n. 180/2024); por onde os pedidos
eletrônicos entram (exclusivamente pelas Centrais Oficiais Nacionais reconhecidas pelo CNJ ou
diretamente pelo site institucional da serventia); as diretrizes de segurança que observa
(Provimento CNJ n. 213/2026, com as alterações do n. 243/2026) e o lema "Autenticidade •
Integridade • Segurança • Rastreabilidade"; e a proteção de dados (LGPD e normas dos serviços
extrajudiciais), com link para a política de privacidade. Os textos DEVEM (SHALL) vir do core,
os mesmos que o carimbo da declaração usa onde coincidem, e NÃO DEVEM (SHALL NOT) afirmar que
o Provimento CGJ/TJRN n. 7/2026 autoriza a plataforma.

#### Scenario: A página abre em qualquer tenant
- **WHEN** o visitante abre `/plataforma` num tenant com qualquer configuração de seções
- **THEN** vê o nome do tenant, as quatro seções e a citação ao Provimento CNJ n. 180/2024

#### Scenario: A regra de canal está escrita
- **WHEN** o visitante lê a página
- **THEN** encontra que os pedidos eletrônicos entram exclusivamente pelas Centrais Oficiais
  Nacionais ou por este site, e nada sobre WhatsApp ou e-mail como canal de pedido
