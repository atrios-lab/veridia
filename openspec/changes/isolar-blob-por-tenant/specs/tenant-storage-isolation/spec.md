## ADDED Requirements

### Requirement: Todo arquivo novo é gravado sob a pasta do seu tenant
Todo arquivo gravado no Blob Store a partir deste change — anexo de cidadão ou imagem de marca — SHALL ser gravado sob um caminho que inclui o slug do tenant dono do registro, no formato `<pasta-do-tipo>/<tenant-slug>/<nome-gerado>`. O caminho de gravação NÃO DEVE (SHALL NOT) depender de nenhum dado fornecido pelo remetente do arquivo além do próprio conteúdo: o nome continua sendo um identificador gerado pelo servidor, nunca o nome original do arquivo.

#### Scenario: Anexo de um pedido de serviço
- **WHEN** um cidadão da serventia de slug `cartorio-marinho` envia um anexo num pedido
- **THEN** o arquivo é gravado em `anexos/cartorio-marinho/<id-gerado>.<ext>`

#### Scenario: Imagem de identidade visual
- **WHEN** a serventia de slug `cartorio-marinho` publica um novo logotipo pelo painel
- **THEN** o arquivo é gravado em `marca/cartorio-marinho/<id-gerado>.<ext>`

#### Scenario: Duas serventias nunca compartilham pasta
- **WHEN** a serventia `cartorio-marinho` e a serventia `1o-tabelionato` enviam anexos no mesmo minuto
- **THEN** os arquivos são gravados em pastas diferentes, uma sob `anexos/cartorio-marinho/` e outra sob `anexos/1o-tabelionato/`

### Requirement: A emissão de token de upload direto valida o tenant do pathname pedido
A rota que emite o token de upload direto para o Blob Store SHALL resolver o tenant da própria requisição (mesmo mecanismo usado no restante do site público) e SHALL recusar a emissão do token quando o segmento de tenant do pathname pedido pelo cliente for diferente do tenant resolvido da requisição.

#### Scenario: Pathname do próprio tenant é aceito
- **WHEN** o site da serventia `cartorio-marinho` pede um token para o pathname `anexos/cartorio-marinho/<id-gerado>.pdf`
- **THEN** o token é emitido normalmente

#### Scenario: Pathname de outro tenant é recusado
- **WHEN** uma requisição feita no site da serventia `cartorio-marinho` pede um token para o pathname `anexos/1o-tabelionato/<id-gerado>.pdf`
- **THEN** a emissão do token é recusada, do mesmo jeito que um pathname em formato inválido já é recusado hoje

### Requirement: Arquivos gravados antes deste change continuam servidos sem alteração
Nenhum arquivo gravado nos caminhos achatados anteriores a este change SHALL exigir remoção, cópia ou re-gravação: sua URL já persistida no banco continua sendo a fonte da verdade para servi-lo.

#### Scenario: Anexo antigo continua acessível
- **WHEN** um pedido de serviço criado antes deste change tem um anexo salvo em `anexos/<id-gerado>.pdf` (sem pasta de tenant)
- **THEN** esse anexo continua sendo aberto e baixado normalmente pela URL já gravada no registro
