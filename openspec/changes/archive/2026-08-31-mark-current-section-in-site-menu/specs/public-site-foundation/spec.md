## MODIFIED Requirements

### Requirement: Shell público com navegação gated
Toda página pública DEVE (SHALL) compartilhar cabeçalho (selo, nome e subtítulo do tenant, navegação)
e rodapé (navegação secundária e texto legal do tenant). Itens de navegação e atalhos DEVEM (SHALL)
aparecer somente quando a seção correspondente está habilitada para o tenant
(`enabledSections`); esconder o item não substitui a checagem de gating no servidor da rota.

A navegação DEVE (SHALL) marcar o link da página em que o visitante está, com `aria-current="page"`
e com destaque visual, e apenas esse. A marcação DEVE (SHALL) acompanhar navegação feita no
cliente, sem depender de recarregamento. Uma seção que expande em mais de um link (ver
`sectionNavLinks`) DEVE (SHALL) ser marcada pelo endereço aberto, não pela seção inteira. O rodapé
NÃO precisa (SHALL NOT be required to) marcar nada: ali a navegação é atalho, não localização.

#### Scenario: Seção desabilitada some da navegação
- **WHEN** o tenant tem uma seção desabilitada (ex.: `ouvidoria` em `disabledSections`)
- **THEN** nenhum link para essa seção aparece no cabeçalho, rodapé ou blocos da home

#### Scenario: Mobile-first
- **WHEN** qualquer página pública é aberta em viewport 390px
- **THEN** o conteúdo renderiza sem overflow horizontal e com as ações principais acessíveis

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
