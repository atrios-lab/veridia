## ADDED Requirements

### Requirement: Serventia de Major Sales servida por host próprio

A plataforma SHALL servir o Ofício Único de Major Sales / RN (CNS 09.507-5) como tenant
registrado, resolvido pelos hosts `cartoriomajorsales.com.br` e `majorsales.localhost`, com
todas as seis atribuições legais e sem nenhum código específico dessa serventia.

#### Scenario: Host do cartório resolve o tenant certo

- **WHEN** uma rota pública é servida para o host `cartoriomajorsales.com.br` (ou
  `majorsales.localhost` em desenvolvimento)
- **THEN** a página responde com o nome, o tema, os contatos e o texto institucional de Major
  Sales, e nunca com os de outra serventia

#### Scenario: Ofício único expõe as seções de todas as atribuições

- **WHEN** o cidadão abre o site de Major Sales
- **THEN** a navegação expõe as seções liberadas pelas seis atribuições (RCPN, NOTAS, RI,
  PROTESTO, RTD, RCPJ), pelo mesmo gating aplicado às demais serventias

#### Scenario: Serventia sem endereço cadastrado

- **WHEN** a página de contato de Major Sales é renderizada e o tenant não declara `address`
- **THEN** a página omite o cartão de endereço e a rota "Como chegar", exibindo normalmente os
  demais canais de atendimento
