## ADDED Requirements

### Requirement: Qualificação de títulos em Utilitários com permissão própria
O painel DEVE (SHALL) ter Utilitários › Qualificação de títulos, aberto só a quem tem a permissão
própria em Perfis e permissões. Uma qualificação DEVE (SHALL) ser aberta a partir de um pedido do
balcão online (protocolo REQ) ou do balcão presencial, com o título e os documentos anexados, a
atribuição (registro de imóveis, títulos e documentos, pessoas jurídicas) e o ato pedido (registro,
averbação, retificação, cancelamento, abertura de matrícula).

#### Scenario: Qualificação aberta pelo pedido do balcão online
- **WHEN** a serventia envia à qualificação um pedido com protocolo REQ
- **THEN** a qualificação nasce com o apresentante, o protocolo e os anexos do pedido

#### Scenario: Sem permissão
- **WHEN** uma pessoa sem a permissão abre a tela
- **THEN** a tela não é encontrada

### Requirement: Exigências estruturadas e biblioteca de exigências
Cada exigência DEVE (SHALL) ter título, descrição, o que apresentar para cumprir, fundamento legal,
o imóvel ou documento a que se refere e a situação (pendente, cumprida, cumprida em parte, nova).
A serventia DEVE (SHALL) manter uma biblioteca de exigências e de blocos de fundamentos gerais por
atribuição e tipo de ato, editável, com exclusão por marca e justificativa, iniciada a partir dos
modelos da serventia reescritos sem dados de clientes.

#### Scenario: Exigência da biblioteca na nota
- **WHEN** a pessoa escolhe uma exigência da biblioteca
- **THEN** ela entra na nota com o fundamento e o texto-base, e pode ser editada só naquela nota

### Requirement: Nota devolutiva no padrão da serventia
A nota devolutiva DEVE (SHALL) ser numerada por ano (nº/ano) e trazer o cabeçalho oficial, o
apresentante, o documento apresentado, o protocolo, o objeto, a natureza da devolução, os
fundamentos, todas as exigências de uma só vez, numeradas e agrupadas por imóvel ou documento, a
forma de cumprimento, a conclusão com o direito de requerer a suscitação de dúvida, as referências,
o prazo, a data, a identificação e a assinatura do oficial ou preposto (Lei nº 6.015/1973, art. 198).
DEVE (SHALL) sair em PDF e Word, ser assinada digital ou fisicamente e poder ser editada, excluída
com justificativa e ter a numeração modificada.

#### Scenario: Nota emitida e enviada
- **WHEN** a pessoa aprova a nota de uma qualificação ligada a um pedido
- **THEN** a nota recebe o próximo número do ano e fica disponível para o apresentante no pedido

### Requirement: Reexame após a reapresentação
Na reapresentação, a nota anterior DEVE (SHALL) ser carregada e cada exigência marcada como
cumprida, cumprida em parte ou pendente; a nova nota DEVE (SHALL) separar o que foi atendido, as
exigências que permanecem, as exigências novas e a lista de providências. Uma exigência nova que não
decorra de documento novo DEVE (SHALL) gerar um aviso, porque as exigências se formulam de uma só vez.

#### Scenario: Exigência nova sem documento novo
- **WHEN** a pessoa inclui uma exigência nova no reexame sem marcar o documento novo que a motivou
- **THEN** a tela avisa antes de emitir a nota

### Requirement: Qualificação positiva
Cumpridas as exigências, ou não havendo nenhuma, o sistema DEVE (SHALL) emitir o termo de
qualificação positiva ("título apto a registro" ou "a averbação"), no mesmo padrão da nota, anexado à
qualificação e ao pedido.

#### Scenario: Título sem exigências
- **WHEN** a pessoa conclui a qualificação sem exigência
- **THEN** sai o termo de qualificação positiva, numerado e assinado

### Requirement: Prazos por atribuição
O sistema DEVE (SHALL) calcular, por atribuição, o prazo para registrar ou devolver com nota e o prazo
da prenotação, com os dias sem expediente da serventia, a partir do texto vigente da lei, e avisar
quando estiverem perto de vencer ou vencidos. As observações da nota DEVEM (SHALL) usar o prazo
calculado.

#### Scenario: Prazo na nota
- **WHEN** a nota é emitida
- **THEN** ela informa o prazo vigente para o cumprimento e a data em que cessa a prenotação

### Requirement: Rascunho proposto pela IA com aprovação humana
Quando o Tabelião ligar a IA em Configurações, a pessoa DEVE (SHALL) poder pedir que a IA leia o
título e os documentos (inclusive digitalizados) e proponha a qualificação positiva ou as exigências,
escolhendo primeiro da biblioteca, cada uma com o fundamento e o trecho do documento que a motivou. A
proposta NÃO DEVE (SHALL NOT) virar nota nem qualificação positiva sem aprovação de uma pessoa; a
aprovação e cada chamada à IA DEVEM (SHALL) ficar na auditoria, sem o conteúdo dos documentos.

#### Scenario: Proposta revisada
- **WHEN** a IA propõe três exigências e a pessoa remove uma e aprova
- **THEN** a nota sai com duas exigências e a auditoria registra quem aprovou

#### Scenario: IA desligada
- **WHEN** a IA está desligada em Configurações
- **THEN** a qualificação funciona só com a biblioteca e a redação manual
