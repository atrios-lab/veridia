## ADDED Requirements

### Requirement: Ofício Único de Cruzeta servido por host próprio

A plataforma SHALL servir o Ofício Único de Cruzeta / RN (CNS 09.554-7) como tenant registrado,
resolvido pelos hosts `cartoriocruzetarn.com.br` e `cruzeta.localhost`, com as seis atribuições
(RCPN, notas, imóveis, protesto, títulos e documentos e pessoas jurídicas), endereço cadastrado e
sem nenhum código específico dessa serventia.

#### Scenario: Host do cartório resolve o tenant certo

- **WHEN** uma rota pública é servida para o host `cartoriocruzetarn.com.br` (ou
  `cruzeta.localhost` em desenvolvimento)
- **THEN** a página responde com o nome, o tema, os contatos e o texto institucional do Ofício
  Único de Cruzeta, e nunca com os de outra serventia

#### Scenario: Serventia com endereço cadastrado

- **WHEN** a página de contato do Ofício Único de Cruzeta é renderizada
- **THEN** a página exibe o cartão de endereço com "Rua João Lopes de Araújo, 215, Centro,
  Cruzeta - RN, 59375-000" e a rota "Como chegar", junto dos demais canais de atendimento
