## ADDED Requirements

### Requirement: Serventia de Brejinho servida por host próprio

A plataforma SHALL servir o Ofício Único de Brejinho / RN (CNS 09.553-9) como tenant
registrado, resolvido pelos hosts `cartoriobrejinhorn.com.br` e `brejinho.localhost`, com todas
as seis atribuições legais, endereço cadastrado e sem nenhum código específico dessa serventia.

#### Scenario: Host do cartório resolve o tenant certo

- **WHEN** uma rota pública é servida para o host `cartoriobrejinhorn.com.br` (ou
  `brejinho.localhost` em desenvolvimento)
- **THEN** a página responde com o nome, o tema, os contatos e o texto institucional de
  Brejinho, e nunca com os de outra serventia

#### Scenario: Ofício único expõe as seções de todas as atribuições

- **WHEN** o cidadão abre o site de Brejinho
- **THEN** a navegação expõe as seções liberadas pelas seis atribuições (RCPN, NOTAS, RI,
  PROTESTO, RTD, RCPJ), pelo mesmo gating aplicado às demais serventias

#### Scenario: Serventia com endereço cadastrado

- **WHEN** a página de contato de Brejinho é renderizada
- **THEN** a página exibe o cartão de endereço com "Av. Antônio Alves Pessoa, 1008, Centro,
  Brejinho - RN, 59219-000" e a rota "Como chegar", junto dos demais canais de atendimento
