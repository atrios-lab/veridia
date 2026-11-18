## ADDED Requirements

### Requirement: Ofício Único de Ruy Barbosa servido por host próprio

A plataforma SHALL servir o Ofício Único de Ruy Barbosa / RN (CNS 09.477-1) como tenant
registrado, resolvido pelos hosts `cartorioruybarbosarn.com.br` e `ruybarbosa.localhost`, com as
seis atribuições (RCPN, notas, imóveis, protesto, títulos e documentos e pessoas jurídicas),
endereço cadastrado e sem nenhum código específico dessa serventia.

#### Scenario: Host do cartório resolve o tenant certo

- **WHEN** uma rota pública é servida para o host `cartorioruybarbosarn.com.br` (ou
  `ruybarbosa.localhost` em desenvolvimento)
- **THEN** a página responde com o nome, o tema, os contatos e o texto institucional do Ofício
  Único de Ruy Barbosa, e nunca com os de outra serventia

#### Scenario: Serventia com endereço cadastrado

- **WHEN** a página de contato do Ofício Único de Ruy Barbosa é renderizada
- **THEN** a página exibe o cartão de endereço com "Rua Conjunto Novo, 02, Centro, Ruy Barbosa -
  RN, 59420-000" e a rota "Como chegar", junto dos demais canais de atendimento
