## ADDED Requirements

### Requirement: Certidão no modelo nacional emitida pelo painel
A área Registro Civil DEVE (SHALL) emitir certidões de nascimento, casamento e óbito (natimorto
dentro de óbito) no modelo nacional, com os campos e a ordem dos modelos usados pela serventia e
a matrícula no alto (decisão de 14/11/2026). A certidão DEVE (SHALL) poder ser emitida a partir de
um registro do índice, já preenchida com o que o índice tem, ou em branco. Todo campo DEVE (SHALL)
poder ser editado. A emissão DEVE (SHALL) exigir a confirmação de que o texto foi conferido com o
livro e uma matrícula de 32 dígitos.

#### Scenario: Emitir a partir da pesquisa
- **WHEN** a pessoa pesquisa um nascimento no índice e clica em Emitir certidão
- **THEN** o formulário vem com nome, matrícula em blocos, datas e filiação preenchidos, e os demais campos em branco para completar com o livro

#### Scenario: Sem conferir com o livro
- **WHEN** a pessoa tenta emitir sem marcar que conferiu com o livro
- **THEN** a certidão não é emitida e a tela diz por quê

### Requirement: Modelos do Provimento 182, inteiro teor e papel de segurança
A certidão de nascimento DEVE (SHALL) seguir o modelo do Provimento nº 182 enviado pela serventia
(14/11/2026): nome; CPF ("NÃO CONSTA" sem ele) e matrícula; data de nascimento com dia, mês e ano;
horário, naturalidade e UF; local, município, UF e sexo; cada genitor com município e UF e os avós
respectivos; gêmeo; data de registro e DNV; anotações e averbações; anotações voluntárias de
cadastro. A certidão em inteiro teor DEVE (SHALL) trazer nome, CPF, matrícula e o registro
transcrito. Impressa, a certidão DEVE (SHALL) sair sem cabeçalho e com o topo livre para o brasão
do papel de segurança, nas medidas do modelo da serventia, em uma folha; assinada digitalmente,
DEVE (SHALL) sair com o cabeçalho e o brasão.

#### Scenario: Impressão no papel de segurança
- **WHEN** a pessoa imprime uma certidão de nascimento
- **THEN** o PDF não desenha o brasão, começa o título abaixo do topo reservado e cabe em uma folha

### Requirement: Selo colado, impressão e assinatura digital
Enquanto o Caixa não existir, a certidão DEVE (SHALL) receber o código do selo digital colado do
lote da serventia, o tipo do selo e a linha de emolumentos, e o PDF DEVE (SHALL) trazer o selo com
o endereço de conferência do TJRN. Um selo já usado em outra certidão não excluída DEVE (SHALL)
ser recusado. O PDF DEVE (SHALL) poder ser impresso para assinar à mão ou assinado digitalmente,
e a via assinada DEVE (SHALL) poder ser anexada.

#### Scenario: Selo repetido
- **WHEN** a pessoa cola um selo que já está em outra certidão
- **THEN** a emissão é recusada com a data da outra certidão

### Requirement: Correção e exclusão com justificativa
A certidão emitida DEVE (SHALL) poder ser corrigida (erro de digitação, selo, assinante) e excluída,
sempre com justificativa registrada na auditoria. A exclusão NÃO DEVE (SHALL NOT) apagar a linha do
banco: ela fica marcada como excluída, com quem, quando e por quê. A permissão "Registro Civil:
emitir, corrigir e excluir certidões" DEVE (SHALL) aparecer em Perfis e permissões.

#### Scenario: Correção de digitação
- **WHEN** a pessoa corrige o nome da mãe com a justificativa "erro de digitação"
- **THEN** o PDF sai com o nome corrigido e a auditoria registra a correção com a justificativa

### Requirement: Prévia antes de emitir
O painel DEVE (SHALL) permitir visualizar e imprimir a certidão antes de emitir, a partir da ficha
do registro (breve relato e inteiro teor) e do formulário de emissão, com a marca "PRÉVIA · SEM
VALOR DE CERTIDÃO" em cada folha. A prévia NÃO DEVE (SHALL NOT) gravar a certidão, usar o selo nem
ir para a auditoria.

#### Scenario: Conferir antes de emitir
- **WHEN** a escrevente clica em "Visualizar e imprimir prévia" no formulário
- **THEN** abre em outra aba o PDF com o que está digitado e a marca "PRÉVIA", e nenhuma certidão é emitida

### Requirement: Modelos do Provimento nº 182/2024 sem alteração
As certidões DEVEM (SHALL) seguir os Anexos IV (nascimento), V (casamento), VI (óbito ou natimorto)
e VII (inteiro teor) do Provimento nº 182/2024 do CNJ: os mesmos campos, legendas e ordem; nome e
matrícula centralizados, sem caixa; dia, mês e ano em números; o rodapé com a serventia à
esquerda e a fé, a data e a assinatura à direita. O painel NÃO DEVE (SHALL NOT) permitir mudar
campos ou legendas do modelo; só os valores vêm do registro. Os campos que o modelo manda
mostrar só quando existirem (segundo genitor e seus avós, gêmeo, anotações voluntárias de
cadastro) DEVEM (SHALL) ficar fora da certidão quando vazios. Uma certidão de casamento ou óbito
emitida antes no modelo antigo DEVE (SHALL) continuar sendo reimpressa e corrigida no modelo em
que saiu, sem perder dados.

#### Scenario: Digital igual à impressa
- **WHEN** a certidão é gerada para assinatura digital
- **THEN** sai na mesma folha e posições da impressa, com o brasão e "REPÚBLICA FEDERATIVA DO BRASIL / REGISTRO CIVIL DAS PESSOAS NATURAIS" no alto e a nota de assinatura digital no lugar da linha

#### Scenario: Nascimento sem gêmeo
- **WHEN** o registro não tem gêmeo
- **THEN** a certidão sai sem a linha "Gêmeo", como manda o Anexo IV

#### Scenario: Óbito no Anexo VI
- **WHEN** a escrevente emite a certidão de óbito
- **THEN** ela traz data e horário do falecimento, último cônjuge ou convivente, idade, genitores, causa, médico ou testemunhas com o documento, sepultamento, declarante, existência de bens e de filhos
