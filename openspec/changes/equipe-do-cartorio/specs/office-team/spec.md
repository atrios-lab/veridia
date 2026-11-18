## ADDED Requirements

### Requirement: Equipe do cartório cadastrada pelo Tabelião

O painel SHALL ter a tela Configurações › Equipe do cartório, aberta só a quem tem a permissão `team.edit`. Essa permissão SHALL começar só com o Tabelião/Registrador, que a concede em Perfis e permissões. Cada pessoa SHALL ter nome, nível, profissão, Portaria/Matrícula, data da portaria, foto, portaria em PDF, Word da portaria e as marcas "Mostrar no site", "Autorização de imagem" e "Pode assinar documentos". Uma pessoa SHALL sair das listas por arquivamento, sem que o registro seja apagado.

#### Scenario: Só quem tem a permissão abre a tela
- **WHEN** uma pessoa sem `team.edit` abre `/admin/configuracoes/equipe`
- **THEN** recebe 404

#### Scenario: Cadastrar com arquivos
- **WHEN** o Tabelião cadastra uma pessoa com foto, portaria em PDF e Word
- **THEN** a pessoa aparece no painel no nível escolhido, no fim dele, e cada envio fica na auditoria

#### Scenario: Arquivar não apaga
- **WHEN** o Tabelião arquiva uma pessoa
- **THEN** ela some das listas do painel e do site, continua guardada e pode voltar para a equipe

### Requirement: Níveis da hierarquia editáveis

Os níveis SHALL começar na ordem Tabelião e Registrador, Substituto legal, Substituto, Escrevente autorizado, Escrevente, Auxiliar de cartório e Serviços gerais. O Tabelião SHALL poder renomear, reordenar e criar níveis. Um nível com pessoas, inclusive arquivadas, NÃO SHALL poder ser retirado.

#### Scenario: Nível em uso não sai
- **WHEN** o Tabelião tenta tirar um nível que tem uma pessoa arquivada
- **THEN** a tela recusa e diz que o nível ainda tem pessoas

#### Scenario: Reordenar muda o mosaico
- **WHEN** o Tabelião sobe um nível na lista e salva
- **THEN** o mosaico do site passa a mostrar esse nível antes

### Requirement: O site mostra só o que foi autorizado

A página `/equipe` SHALL mostrar apenas as pessoas marcadas em "Mostrar no site" e não arquivadas, agrupadas por nível na ordem dos níveis, com nome, cargo e profissão. A foto SHALL aparecer só com a autorização de imagem registrada. O número da portaria, a data e o link para abrir o PDF SHALL aparecer só quando o PDF da portaria estiver anexado. O Word da portaria NÃO SHALL ser servido ao site.

#### Scenario: Pessoa não marcada
- **WHEN** uma pessoa não está marcada em "Mostrar no site"
- **THEN** ela não aparece em `/equipe` e as rotas públicas de foto e portaria dela respondem 404

#### Scenario: Foto sem autorização
- **WHEN** uma pessoa marcada para o site tem foto enviada mas não tem a autorização de imagem
- **THEN** o site mostra as iniciais no lugar da foto e a rota pública da foto responde 404

#### Scenario: Retirar a autorização tira a foto
- **WHEN** o Tabelião desmarca a autorização de imagem de uma pessoa
- **THEN** a rota pública da foto passa a responder 404

#### Scenario: Portaria anexada é pública
- **WHEN** o Tabelião anexa o PDF da portaria de uma pessoa marcada para o site
- **THEN** o site mostra o número, a data e "Ver portaria", e o PDF abre para qualquer visitante

#### Scenario: Sem portaria anexada
- **WHEN** a pessoa não tem o PDF da portaria
- **THEN** o site mostra só nome, cargo e profissão

#### Scenario: Word nunca vai ao site
- **WHEN** alguém sem login tenta abrir o Word de uma pessoa
- **THEN** não há rota pública para ele e a rota do painel redireciona ao login

### Requirement: Anexar a portaria exige confirmar que é pública

O formulário SHALL avisar que a portaria anexada fica pública (CPF, endereço e outros dados pessoais) e SHALL recusar o anexo sem a confirmação marcada.

#### Scenario: Anexo sem confirmação
- **WHEN** o Tabelião envia o PDF da portaria sem marcar a confirmação
- **THEN** nada é gravado e a tela explica que o arquivo ficará aberto a quem entra no site

### Requirement: Arquivos conferidos pelo conteúdo

O servidor SHALL aceitar a foto em PNG, JPEG ou WebP até 2 MB, a portaria em PDF até 4 MB e o Word em .docx ou .doc até 4 MB, identificando o tipo pelos primeiros bytes. Cada campo SHALL aceitar só o seu tipo.

#### Scenario: Tipo trocado
- **WHEN** um PDF renomeado como .png é enviado no campo da foto
- **THEN** o envio é recusado e nada é gravado

#### Scenario: Arquivo grande
- **WHEN** uma foto de mais de 2 MB é enviada
- **THEN** o envio é recusado com o limite explicado

### Requirement: Quem assina vem da equipe

Quando ao menos uma pessoa da equipe estiver marcada "Pode assinar documentos", a lista de quem assina as guias, o ISS e as declarações SHALL vir da equipe, na ordem em que cada pessoa passou a assinar e não na da hierarquia. A pessoa SHALL manter o seu lugar se deixar de assinar e voltar. Enquanto ninguém da equipe assina, a lista salva em Quem assina SHALL continuar valendo, sem alteração. Com a equipe mandando, as telas de Quem assina SHALL ser de leitura e a ação que salva a lista antiga SHALL recusar.

#### Scenario: Trazer quem assina para a equipe
- **WHEN** o Tabelião usa "Trazer quem assina para a equipe" com duas pessoas em Quem assina
- **THEN** as duas entram na equipe marcadas "Pode assinar", na mesma ordem, e quem já estava na equipe com o mesmo nome é marcado em vez de duplicado

#### Scenario: A ordem não segue a hierarquia
- **WHEN** o Tabelião marca "Pode assinar" no Tabelião depois de duas outras pessoas
- **THEN** o Tabelião é o terceiro da lista de quem assina

#### Scenario: Lista antiga intacta
- **WHEN** ninguém da equipe está marcado para assinar
- **THEN** Quem assina mostra e salva a lista de sempre

#### Scenario: Importar só uma vez
- **WHEN** a equipe já tem quem assina e o Tabelião tenta trazer a lista antiga de novo
- **THEN** a importação recusa

### Requirement: Link no menu só com equipe publicada

O link "Nossa equipe" SHALL aparecer no menu Cidadão e no rodapé só quando houver ao menos uma pessoa publicada. Aberta direto sem ninguém publicado, a página SHALL explicar que a equipe ainda não foi publicada.

#### Scenario: Cartório sem equipe publicada
- **WHEN** ninguém está marcado para o site
- **THEN** o menu e o rodapé não têm "Nossa equipe" e `/equipe` mostra que a equipe ainda não foi publicada
