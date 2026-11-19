## ADDED Requirements

### Requirement: Notícias do cartório cadastradas por quem tem a permissão

O painel SHALL ter a tela Configurações › Notícias e eventos, aberta só a quem tem a permissão `news.edit`. Essa permissão SHALL começar só com o Tabelião/Registrador, que a concede em Perfis e permissões. Cada notícia SHALL ter título, tipo (Casamento comunitário, Evento social, Correição ou Outras notícias), data do evento, resumo, texto, até 8 fotos, um PDF e as marcas "Mostrar no site" e "Autorização de imagem". Uma notícia SHALL sair das listas por arquivamento, sem que o registro seja apagado.

#### Scenario: Só quem tem a permissão abre a tela
- **WHEN** uma pessoa sem `news.edit` abre `/admin/configuracoes/noticias`
- **THEN** recebe 404

#### Scenario: Criar com arquivos
- **WHEN** o Tabelião cria uma notícia com fotos e um PDF
- **THEN** a notícia aparece no painel e cada envio fica na auditoria

#### Scenario: Arquivar não apaga
- **WHEN** o Tabelião arquiva uma notícia
- **THEN** ela some das listas do painel e do site, continua guardada e pode voltar

### Requirement: O site mostra só o que foi marcado

A página `/noticias` SHALL mostrar apenas as notícias marcadas em "Mostrar no site" e não arquivadas, da mais nova para a mais antiga (pela data do evento, senão pelo dia em que foram ao site), com filtro pelos tipos que têm notícia. O link no menu Cidadão e no rodapé SHALL aparecer só quando houver ao menos uma notícia publicada.

#### Scenario: Rascunho não aparece
- **WHEN** uma notícia não está marcada em "Mostrar no site"
- **THEN** o visitante não a vê na lista nem pelo endereço dela

#### Scenario: Sem notícia, sem link
- **WHEN** nenhuma notícia está publicada
- **THEN** o menu não mostra "Notícias e eventos", e a página responde com um aviso de que ainda não há notícias

### Requirement: Fotos e PDF protegidos

As fotos de uma notícia SHALL ser servidas ao visitante só com a autorização de imagem registrada, e o PDF só depois de o painel receber a confirmação de que ele pode ser público. Um arquivo retirado, de notícia não publicada ou arquivada SHALL responder "não encontrado". Retirar um arquivo SHALL manter a linha, marcada como retirada.

#### Scenario: Sem autorização, sem foto
- **WHEN** o Tabelião desmarca a autorização de imagem de uma notícia com fotos
- **THEN** as fotos deixam de aparecer no site e de ser servidas, e o PDF continua

#### Scenario: PDF exige confirmação
- **WHEN** o Tabelião anexa um PDF sem confirmar que pode ser público
- **THEN** o painel recusa o envio

#### Scenario: Troca do PDF
- **WHEN** o Tabelião anexa um segundo PDF
- **THEN** o primeiro deixa de ser servido e o novo passa a valer

### Requirement: Correição só informa

Ao escolher o tipo Correição, o painel SHALL mostrar o aviso de que o Livro de Visitas e Correições é escriturado pela autoridade judiciária e de que a notícia só informa a visita, sem dados pessoais nem o conteúdo da ata.

#### Scenario: Aviso da correição
- **WHEN** o Tabelião escolhe o tipo Correição no formulário
- **THEN** o aviso aparece acima do resumo

### Requirement: Qualificar o título chama a atenção

Em cada pedido, o botão "Qualificar o título deste pedido" SHALL piscar suavemente enquanto não houver qualificação ligada ao pedido, e só onde o sistema do visitante aceita movimento.

#### Scenario: Pedido sem qualificação
- **WHEN** o funcionário abre um pedido sem qualificação ligada
- **THEN** o botão aparece em destaque e pulsa

#### Scenario: Pedido já qualificado
- **WHEN** o pedido já tem uma qualificação
- **THEN** o botão "Abrir outra qualificação" aparece sem pulsar
