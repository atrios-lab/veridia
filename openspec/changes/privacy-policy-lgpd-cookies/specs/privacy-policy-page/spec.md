## ADDED Requirements

### Requirement: Página pública de política de privacidade

O site público SHALL servir a página `/privacidade` com a política de privacidade e proteção de
dados da serventia, acessível sem autenticação e sem gating por atribuição — é obrigação legal
de toda serventia, como o canal LGPD. A página MUST NOT conter formulário: é conteúdo de
leitura.

#### Scenario: Página disponível para qualquer serventia

- **WHEN** o cidadão acessa `/privacidade` em qualquer domínio de serventia
- **THEN** a página é servida com a identidade visual (tema, marca) daquela serventia

### Requirement: Estrutura fixa, dados variáveis por tenant

A estrutura e a redação da política SHALL ser comum a todas as serventias; apenas os dados
institucionais (nome da serventia, CNS, contatos, nome e e-mail do Encarregado) SHALL vir da
configuração do tenant. O sistema MUST NOT permitir texto de política específico de um
cartório.

#### Scenario: Serventia distinta, mesmos requisitos

- **WHEN** a página é servida para outra serventia
- **THEN** o texto institucional é o mesmo e apenas nome, CNS, contatos e Encarregado mudam,
  sem alteração de código

### Requirement: Conteúdo mínimo exigido pela LGPD

A política SHALL informar, em linguagem clara: quais dados pessoais são coletados em cada canal
do site (pedidos de serviço, agendamento, ouvidoria, canal LGPD, chat), a finalidade e a base
legal do tratamento, os prazos de guarda (incluindo a guarda obrigatória de atos registrais), os
direitos do titular com link para o canal `/lgpd`, o contato do Encarregado (art. 41, §3º da
LGPD) e a seção sobre cookies declarando que o site usa apenas cookies essenciais.

#### Scenario: Direitos do titular apontam para o canal existente

- **WHEN** o cidadão lê a seção de direitos do titular
- **THEN** encontra link para `/lgpd` como via de exercício dos direitos, com o prazo legal de
  15 dias declarado

#### Scenario: Encarregado publicado na política

- **WHEN** a página é exibida
- **THEN** o nome e o e-mail institucional do Encarregado da serventia aparecem, vindos da
  configuração do tenant

### Requirement: Política linkada no rodapé do site público

O rodapé do site público SHALL conter link permanente "Política de privacidade" para
`/privacidade`, visível em todas as páginas públicas.

#### Scenario: Link presente em qualquer página pública

- **WHEN** o cidadão está em qualquer página do site público
- **THEN** o rodapé exibe o link para a política de privacidade
