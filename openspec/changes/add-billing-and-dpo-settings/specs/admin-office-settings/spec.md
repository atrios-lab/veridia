## MODIFIED Requirements

### Requirement: Tela de Configurações com faixa de abas

A rota `/admin/configuracoes` SHALL exigir sessão válida na serventia do host e a permissão
`content.edit`, checadas no servidor. A tela SHALL apresentar uma faixa com as quatro abas —
Serventia, Identidade Visual, Encarregado e Cobrança —, e cada uma SHALL navegar para a sua tela.

A faixa SHALL oferecer como link apenas as abas cuja permissão o usuário tem; as demais SHALL
aparecer inertes e não focáveis por teclado. A faixa é cortesia, nunca o controle: a rota atrás de
cada aba SHALL checar a própria permissão no servidor.

#### Scenario: Aba Serventia é a inicial

- **WHEN** um usuário com `content.edit` abre `/admin/configuracoes`
- **THEN** a aba Serventia aparece selecionada e seu conteúdo é o renderizado

#### Scenario: As quatro abas navegam

- **WHEN** um usuário com todas as permissões clica em "Cobrança"
- **THEN** a URL passa a ser `/admin/configuracoes/cobranca` e a aba Cobrança aparece selecionada

#### Scenario: Aba sem permissão não é oferecida

- **WHEN** um usuário sem `branding.edit` abre a tela de Configurações
- **THEN** a aba Identidade Visual aparece inerte, sem link e sem foco por teclado

#### Scenario: Acesso sem permissão

- **WHEN** um usuário autenticado sem `content.edit` requisita `/admin/configuracoes`
- **THEN** o servidor recusa o acesso, mesmo que a pessoa tenha chegado por URL direta
