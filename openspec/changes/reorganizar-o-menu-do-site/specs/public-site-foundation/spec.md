## MODIFIED Requirements

### Requirement: Shell público com navegação gated
Toda página pública DEVE (SHALL) compartilhar cabeçalho (selo, nome e subtítulo do tenant, navegação)
e rodapé (navegação secundária e texto legal do tenant). Itens de navegação e atalhos DEVEM (SHALL)
aparecer somente quando a seção correspondente está habilitada para o tenant
(`enabledSections`); esconder o item não substitui a checagem de gating no servidor da rota.

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

#### Scenario: O grupo se marca quando a página aberta está dentro dele
- **WHEN** o visitante está em `/solicitar` no desktop, com o submenu fechado
- **THEN** o botão "Serviços" aparece destacado e com `aria-current="true"`, "Cidadão" não, e o
  único elemento com `aria-current="page"` é o link "Solicitar serviço" dentro do submenu

#### Scenario: O submenu fecha ao navegar
- **WHEN** o visitante escolhe uma página dentro de um submenu
- **THEN** a página abre e o submenu fecha sozinho, sem um segundo toque

#### Scenario: O menu do celular é agrupado por tarefa
- **WHEN** o visitante abre o menu em 390px
- **THEN** "Início" vem primeiro, seguido dos grupos "Serviços" e "Cidadão", e a lista rola por
  dentro se for mais alta que a tela

#### Scenario: O cabeçalho cabe no tablet
- **WHEN** qualquer página pública é aberta em viewport 768px
- **THEN** o cabeçalho não provoca rolagem horizontal e o menu do celular é o que aparece

#### Scenario: A página aberta aparece marcada no menu
- **WHEN** o visitante está em `/solicitar` e abre o menu
- **THEN** "Solicitar serviço" aparece marcada como página atual (`aria-current="page"`), com
  destaque visual, e nenhuma outra opção está marcada

#### Scenario: A marcação acompanha a navegação no cliente
- **WHEN** o visitante está em `/editais`, abre o menu e toca em "Ouvidoria", sem recarregar
- **THEN** "Ouvidoria" passa a ser a única marcada, e "Editais" deixa de estar

#### Scenario: Seção de dois links marca só o endereço aberto
- **WHEN** o visitante está em `/contato`, que pertence à seção "Centrais e contato" junto de
  `/centrais`
- **THEN** apenas "Contato" aparece marcada, e "Centrais" não

#### Scenario: Fora das seções, nada é marcado
- **WHEN** o visitante está numa página que o menu não lista (ex.: `/privacidade`)
- **THEN** o menu abre sem nenhuma opção marcada, em vez de marcar uma por aproximação
