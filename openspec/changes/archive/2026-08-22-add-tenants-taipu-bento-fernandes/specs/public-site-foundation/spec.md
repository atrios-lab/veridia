## ADDED Requirements

### Requirement: Serventias de Taipu e Bento Fernandes servidas por host próprio

A plataforma SHALL servir o Serviço Único Notarial e Registral de Taipu (CNS 09.377-3, hosts
`cartoriotaipurn.com` / `taipu.localhost`) e o Ofício Único de Bento Fernandes (CNS 09.502-6,
hosts `cartoriobentofernandesrn.com.br` / `bentofernandes.localhost`) como tenants registrados,
cada um com as seis atribuições legais e sem nenhum código específico de qualquer serventia.

#### Scenario: Host de cada cartório resolve o tenant certo

- **WHEN** uma rota pública é servida para `cartoriotaipurn.com` (ou `taipu.localhost`) e,
  separadamente, para `cartoriobentofernandesrn.com.br` (ou `bentofernandes.localhost`)
- **THEN** cada resposta usa o nome, o tema, os contatos e o texto institucional da respectiva
  serventia, e nunca os de outra

#### Scenario: Ofício único expõe as seções de todas as atribuições

- **WHEN** o cidadão abre o site de Taipu ou de Bento Fernandes
- **THEN** a navegação expõe as seções liberadas pelas seis atribuições, pelo mesmo gating
  aplicado às demais serventias

#### Scenario: Bento Fernandes sem endereço cadastrado

- **WHEN** a página de contato de Bento Fernandes é renderizada e o tenant não declara `address`
- **THEN** a página omite o cartão de endereço e a rota "Como chegar", exibindo normalmente os
  demais canais de atendimento
