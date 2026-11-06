## ADDED Requirements

### Requirement: Tipo do ato nos atos que agrupam mais de um
O catálogo DEVE (SHALL) declarar opções de tipo somente nos atos que agrupam tipos excludentes entre si:

| Ato | Tipos |
|---|---|
| `rcpn-certidao` | Certidão de nascimento, Certidão de casamento, Certidão de óbito, Outra certidão |
| `notas-escritura` | Escritura pública, Procuração |
| `ri-certidao-matricula` | Certidão de matrícula, Certidão de inteiro teor, Certidão de ônus |
| `ri-busca-indicador` | Busca por indicador pessoal, Busca por indicador real |
| `ri-registro-titulo` | Registro na matrícula, Averbação na matrícula |
| `rtd-registro-documento` | Registro de documento, Registro de contrato |

Quando o ato tiver tipos, o formulário público DEVE (SHALL) mostrar um select obrigatório imediatamente acima do campo de descrição. O servidor DEVE (SHALL) recusar o pedido sem tipo, com tipo que não pertença ao ato ou com tipo em ato que não os tenha. Ao escolher "Outra certidão", a descrição DEVE (SHALL) ser obrigatória. O tipo escolhido DEVE (SHALL) ser gravado no registro do pedido. Atos sem tipos NÃO DEVEM (SHALL NOT) mostrar o select.

#### Scenario: Ato com tipos mostra o select acima da descrição
- **WHEN** o cidadão abre o formulário de "Certidão (nascimento, casamento, óbito)"
- **THEN** um select com os quatro tipos aparece imediatamente acima do campo de descrição, sem opção pré-selecionada

#### Scenario: Ato sem tipos não mostra o select
- **WHEN** o cidadão abre o formulário de "Habilitação de casamento"
- **THEN** o select de tipo não aparece

#### Scenario: Atos com opções não excludentes ficam sem select
- **WHEN** o cidadão abre o formulário de "Registro de constituição (estatuto, ata, contrato)" ou de "Retificação de registro (área, descrição)"
- **THEN** o select de tipo não aparece

#### Scenario: Pedido sem tipo é recusado
- **WHEN** o cidadão envia uma certidão RCPN sem escolher o tipo
- **THEN** o pedido não é criado e o erro aparece no campo do tipo

#### Scenario: Tipo de outro ato é recusado no servidor
- **WHEN** uma submissão de certidão RCPN chega com o tipo `procuracao`
- **THEN** o pedido não é criado e o servidor devolve erro no campo do tipo

#### Scenario: Tipo enviado para ato sem tipos é recusado
- **WHEN** uma submissão de "Habilitação de casamento" chega com um tipo preenchido
- **THEN** o pedido não é criado e o servidor devolve erro no campo do tipo

#### Scenario: Outra certidão exige descrição
- **WHEN** o cidadão escolhe "Outra certidão" e deixa a descrição em branco
- **THEN** o pedido não é criado e o erro aparece no campo de descrição

#### Scenario: Tipo escolhido fica gravado
- **WHEN** o cidadão envia uma certidão RCPN com o tipo "Certidão de casamento" e os demais campos válidos
- **THEN** o pedido é criado com esse tipo gravado no registro

### Requirement: Tipo do ato no pedido de gratuidade
Na entrada "Solicitar gratuidade", quando o ato escolhido tiver tipos, o formulário DEVE (SHALL) pedir o tipo dentro do bloco da gratuidade, com as mesmas regras de validação do pedido comum. O tipo NÃO DEVE (SHALL NOT) integrar o conteúdo da declaração nem o hash do aceite. Ao trocar o ato escolhido, o tipo já selecionado DEVE (SHALL) ser descartado.

#### Scenario: Gratuidade de certidão pede o tipo
- **WHEN** o cidadão escolhe a certidão como ato da gratuidade
- **THEN** o select de tipo aparece dentro do bloco da gratuidade e é obrigatório para enviar

#### Scenario: Gratuidade de ato sem tipos não pede o tipo
- **WHEN** o cidadão escolhe "Habilitação de casamento" como ato da gratuidade
- **THEN** o select de tipo não aparece

#### Scenario: Trocar o ato descarta o tipo
- **WHEN** o cidadão escolhe a certidão, seleciona um tipo e depois troca para "Habilitação de casamento"
- **THEN** o pedido pode ser enviado sem erro de tipo e nenhum tipo é gravado

#### Scenario: Declaração e hash não mudam
- **WHEN** dois pedidos de gratuidade de certidão têm o mesmo conteúdo aceito e tipos diferentes
- **THEN** o hash do aceite calculado é o mesmo para os dois

### Requirement: Nome específico do ato para o cidadão
Quando o pedido tiver um tipo gravado, a tela de sucesso, a consulta do protocolo e o campo "Ato requerido" do requerimento em PDF DEVEM (SHALL) mostrar o nome do tipo no lugar do nome agrupado. No pedido de gratuidade, o requerimento DEVE (SHALL) citar o nome do tipo ao indicar o ato pedido. O pedido sem tipo gravado, ou com um tipo que não exista mais no catálogo, DEVE (SHALL) mostrar o nome do ato, sem expor o identificador gravado.

#### Scenario: Requerimento e consulta mostram o tipo
- **WHEN** o cidadão consulta o protocolo ou baixa o requerimento de um pedido com o tipo "Certidão de casamento"
- **THEN** o documento e a tela mostram "Certidão de casamento"

#### Scenario: Pedido antigo mantém o nome do ato
- **WHEN** o cidadão consulta um pedido criado antes da existência do tipo
- **THEN** a tela mostra "Certidão (nascimento, casamento, óbito)"

#### Scenario: Tipo retirado do catálogo não vaza identificador
- **WHEN** o pedido tem gravado um tipo que não existe mais no catálogo
- **THEN** a tela mostra o nome do ato, sem o identificador gravado

### Requirement: Pedido duplicado considera o tipo do ato
Quando o novo pedido tiver um tipo, a verificação de pedido duplicado DEVE (SHALL) considerar duplicado apenas o pedido em aberto do mesmo tenant, ato, cidadão e tipo. O pedido em aberto sem tipo gravado NÃO DEVE (SHALL NOT) bloquear um novo pedido com tipo, porque não se sabe o que ele pediu. Quando o novo pedido não tiver tipo, a verificação DEVE (SHALL) continuar comparando tenant, ato e cidadão.

#### Scenario: Tipo diferente do mesmo ato não bloqueia
- **WHEN** o cidadão tem uma certidão de nascimento em aberto e pede uma certidão de casamento
- **THEN** o novo pedido é criado normalmente, sem o diálogo de duplicidade

#### Scenario: Mesmo tipo do mesmo ato bloqueia
- **WHEN** o cidadão tem uma certidão de casamento em aberto e pede outra certidão de casamento
- **THEN** nenhum pedido novo é criado e o diálogo mostra o protocolo existente

#### Scenario: Pedido aberto sem tipo não bloqueia
- **WHEN** o cidadão tem em aberto uma certidão sem tipo gravado e pede uma certidão de casamento
- **THEN** o novo pedido é criado normalmente

#### Scenario: Ato sem tipos segue a regra anterior
- **WHEN** o cidadão tem uma "Habilitação de casamento" em aberto e pede outra
- **THEN** nenhum pedido novo é criado e o diálogo mostra o protocolo existente
