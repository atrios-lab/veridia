## ADDED Requirements

### Requirement: 2º Ofício de João Câmara servido por host próprio

A plataforma SHALL servir o 2º Ofício de João Câmara / RN (CNS 09.420-1) como tenant registrado,
resolvido pelos hosts `2cartoriojoaocamararn.com.br` e `joaocamara.localhost`, com as
atribuições de notas, protesto e registro civil das pessoas naturais, endereço cadastrado e sem
nenhum código específico dessa serventia.

#### Scenario: Host do cartório resolve o tenant certo

- **WHEN** uma rota pública é servida para o host `2cartoriojoaocamararn.com.br` (ou
  `joaocamara.localhost` em desenvolvimento)
- **THEN** a página responde com o nome, o tema, os contatos e o texto institucional do 2º
  Ofício de João Câmara, e nunca com os de outra serventia

#### Scenario: Só as seções das três atribuições

- **WHEN** o cidadão abre o site do 2º Ofício de João Câmara
- **THEN** a navegação expõe as seções liberadas por RCPN, NOTAS e PROTESTO, e não as que
  dependem só de RI, RTD ou RCPJ, pelo mesmo gating aplicado às demais serventias

#### Scenario: Serventia com endereço cadastrado

- **WHEN** a página de contato do 2º Ofício de João Câmara é renderizada
- **THEN** a página exibe o cartão de endereço com "Rua Antônio Proença, 241, Centro, João
  Câmara - RN, 59550-000" e a rota "Como chegar", junto dos demais canais de atendimento
