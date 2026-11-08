## MODIFIED Requirements

### Requirement: Proclamas vem com saída pré-preenchida em 15 dias

Ao informar a data da publicação, o formulário SHALL pré-preencher a data de saída com o fim do prazo legal do tipo de edital (para proclamas, 15 dias), ajustável pelo operador antes de salvar. Aviso e edital sem tipo do catálogo não têm sugestão.

#### Scenario: Sugestão de 15 dias
- **WHEN** o operador escolhe o tipo "Proclamas" e informa a data da publicação
- **THEN** a data de saída é pré-preenchida com o fim dos 15 dias, e o operador pode alterá-la

#### Scenario: Aviso não tem sugestão
- **WHEN** o operador escolhe o tipo "Aviso"
- **THEN** a data de saída não é pré-preenchida

### Requirement: Publicação carrega o arquivo do edital
A publicação DEVE (SHALL) poder ter um anexo (PDF ou imagem), validado pelos mesmos limites de tipo e tamanho dos demais anexos da plataforma. O texto continua obrigatório. Trocar o arquivo DEVE (SHALL) apagar o anterior do armazenamento. A rota `/publicacoes/[id]/arquivo` DEVE (SHALL) entregar o anexo de qualquer tipo de publicação apenas enquanto ela está vigente; `/editais/[id]/arquivo` continua respondendo igual. O anexo DEVE (SHALL) aparecer junto da publicação na página inicial e em `/editais`: imagem JPEG, PNG ou WebP no próprio cartão; PDF ou HEIC como link que abre em nova aba.

#### Scenario: Aviso com imagem na página inicial
- **WHEN** o operador publica um aviso com uma foto anexada
- **THEN** a página inicial mostra a foto dentro do cartão do aviso

#### Scenario: Edital com o documento anexado
- **WHEN** o operador publica um edital com o PDF anexado
- **THEN** a página inicial e `/editais` oferecem "Abrir o documento (PDF)"

#### Scenario: Rascunho não vaza o arquivo
- **WHEN** alguém chama a rota do anexo de uma publicação em rascunho, com o id correto
- **THEN** a resposta é 404, como se não existisse

## ADDED Requirements

### Requirement: Edital tem tipo com regra legal de publicações e prazo
Um edital DEVE (SHALL) poder escolher, dentro do setor, um tipo do catálogo `NOTICE_TYPES`, cada um com dispositivo legal, número de publicações, intervalo entre elas e prazo, contado em dias úteis salvo quando a lei diz dias corridos. O formulário DEVE (SHALL) oferecer também "Outro (sem prazo calculado)". O servidor DEVE (SHALL) recusar tipo desconhecido ou de outro setor. Proclamas recebem sempre o tipo `proclamas-casamento`; aviso nunca tem tipo.

#### Scenario: Usucapião com notificação por edital
- **WHEN** o operador escolhe "Usucapião, notificação por edital" com 1ª publicação em 20/10/2026
- **THEN** o formulário mostra a 2ª publicação em 11/11/2026 e o prazo para manifestação até 03/12/2026, e pré-preenche a saída com 03/12/2026

#### Scenario: Tipo de outro setor recusado
- **WHEN** um POST envia um edital do setor Protesto com o tipo `loteamento`
- **THEN** o servidor recusa, apontando o campo do tipo

### Requirement: Data da publicação pode ser retroativa
A data da publicação DEVE (SHALL) aceitar dia passado, para registrar edital já publicado. As publicações e o prazo DEVEM (SHALL) ser calculados a partir dela. Se o prazo já terminou, o formulário DEVE (SHALL) avisar que a publicação vai direto para Arquivadas.

#### Scenario: Edital publicado há um mês
- **WHEN** o operador registra hoje um edital cuja 1ª publicação foi há um mês
- **THEN** o site o mostra na etapa em que ele está hoje, com o prazo calculado da data informada

### Requirement: Republicação calculada na leitura
Quando a regra pede mais de uma publicação, o site DEVE (SHALL) identificar a publicação em curso pela data de hoje, mostrando "2ª publicação" (ou 3ª) e a data dela, sem gravação por tarefa. Em `/editais`, a republicação DEVE (SHALL) informar também a data da 1ª.

#### Scenario: Segunda publicação começa
- **WHEN** chega a data da 2ª publicação de um edital vigente
- **THEN** a página inicial passa a mostrar "Edital · <tipo> · 2ª publicação · <data da 2ª>", no topo da seção
