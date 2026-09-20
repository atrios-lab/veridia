## ADDED Requirements

### Requirement: Serventia de Canguaretama servida por host próprio

A plataforma SHALL servir o Ofício Único de Registros e Notas de Canguaretama / RN (CNS
09.519-0) como tenant registrado, resolvido pelos hosts `cartoriocanguaretamarn.com.br` e
`canguaretama.localhost`, com todas as seis atribuições legais, endereço cadastrado e sem nenhum
código específico dessa serventia.

#### Scenario: Host do cartório resolve o tenant certo

- **WHEN** uma rota pública é servida para o host `cartoriocanguaretamarn.com.br` (ou
  `canguaretama.localhost` em desenvolvimento)
- **THEN** a página responde com o nome, o tema, os contatos e o texto institucional de
  Canguaretama, e nunca com os de outra serventia

#### Scenario: Ofício único expõe as seções de todas as atribuições

- **WHEN** o cidadão abre o site de Canguaretama
- **THEN** a navegação expõe as seções liberadas pelas seis atribuições (RCPN, NOTAS, RI,
  PROTESTO, RTD, RCPJ), pelo mesmo gating aplicado às demais serventias

#### Scenario: Serventia com endereço cadastrado

- **WHEN** a página de contato de Canguaretama é renderizada
- **THEN** a página exibe o cartão de endereço com "Rua André de Albuquerque, 155, Centro,
  Canguaretama - RN, 59190-000" e a rota "Como chegar", junto dos demais canais de atendimento
