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

### Requirement: Publicação feita por engano pode ser excluída
Toda publicação, em qualquer aba, DEVE (SHALL) oferecer "Excluir", com confirmação que diferencia de "Arquivar agora". Excluir remove a linha e o arquivo anexado e DEVE (SHALL) deixar registro na auditoria. Rascunho exige `content.edit`; publicação que já teve data de entrada exige também `content.publish`.

#### Scenario: Publicação errada excluída
- **WHEN** o operador com `content.publish` confirma "Excluir" num aviso publicado por engano
- **THEN** o aviso some do site e do painel, o anexo é apagado e a auditoria registra `publication.delete`

#### Scenario: Staff não exclui o que está no ar
- **WHEN** um usuário sem `content.publish` tenta excluir uma publicação que já foi ao ar
- **THEN** o servidor recusa, mesmo que o botão apareça

### Requirement: Anexo não passa pelo corpo da função no deploy
No deploy com Blob configurado, o anexo da publicação DEVE (SHALL) ir do navegador direto ao armazenamento, como os anexos do cidadão, e a rota do anexo DEVE (SHALL) redirecionar para o arquivo depois de conferir a vigência, sem repassar os bytes. A requisição e a resposta de uma função da Vercel têm teto de cerca de 4,5 MB, abaixo de uma foto de celular ou de um PDF escaneado.

#### Scenario: Foto grande publicada direto
- **WHEN** o operador publica um aviso com uma foto de 8 MB, sem passar por rascunho
- **THEN** a publicação é salva com o anexo, e a imagem aparece no cartão da página inicial

### Requirement: Toda publicação abre num detalhe com texto, datas e arquivo
Em qualquer aba (No site, Agendadas, Arquivadas, Rascunhos), o título da publicação DEVE (SHALL) abrir uma tela de detalhe com tipo, setor, tipo de edital e dispositivo legal, cada publicação e o fim do prazo, data de saída, datas de cadastro, de última alteração e de arquivamento, o texto completo e o arquivo anexado (imagem na tela, PDF por link). A tela DEVE (SHALL) oferecer Editar e Excluir, e Arquivar quando ainda não arquivada. O arquivo DEVE (SHALL) ser servido ao painel em qualquer estado, mediante sessão com `content.edit` e da mesma serventia. Publicação arquivada DEVE (SHALL) poder ser editada, sem sair do arquivo por isso.

#### Scenario: Conferir um edital arquivado
- **WHEN** o operador clica no título de um edital em Arquivadas
- **THEN** vê o texto publicado, as datas, a regra legal e abre o PDF que foi publicado

#### Scenario: Excluir pelo detalhe
- **WHEN** o operador confirma "Excluir" na tela de detalhe
- **THEN** volta para a lista da aba de onde veio, sem a publicação

### Requirement: Arquivo da publicação fica 30 dias e depois é apagado
O arquivo de uma publicação (PDF ou imagem) DEVE (SHALL) ficar disponível por 30 dias contados do envio, em qualquer estado, e depois DEVE (SHALL) ser apagado do armazenamento, ficando só as informações escritas (tipo, título, texto, datas, nome, tipo e tamanho do arquivo, histórico). Se a publicação estiver no site no fim dos 30 dias, o arquivo fica até ela sair. A regra é da plataforma, a mesma prometida para os documentos dos pedidos; a justificativa é a LGPD (art. 6º, III, e arts. 15 e 16), que não fixa o número de dias.

O formulário DEVE (SHALL) avisar a regra antes de salvar e dizer, ao salvar, até quando o arquivo fica. A lista DEVE (SHALL) lembrar os arquivos que vencem em até 7 dias, e o detalhe DEVE (SHALL) oferecer "Baixar o arquivo" e mostrar o histórico com quem fez cada ação.

O expurgo roda quando a lista do painel abre; as rotas recusam o arquivo vencido mesmo antes disso. Cada arquivo apagado DEVE (SHALL) deixar `publication.attachment-purge` na auditoria.

#### Scenario: Rascunho com arquivo de 40 dias
- **WHEN** a lista do painel abre e há um rascunho cujo arquivo foi enviado há 40 dias
- **THEN** o arquivo é apagado, o rascunho continua com o texto, e o detalhe diz quando e por quê

#### Scenario: Edital no ar com o prazo legal correndo
- **WHEN** passam 30 dias do envio e o edital ainda está no site
- **THEN** o arquivo continua no site até a publicação sair, e é apagado depois
