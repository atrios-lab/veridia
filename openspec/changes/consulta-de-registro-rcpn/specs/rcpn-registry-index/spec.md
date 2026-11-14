## ADDED Requirements

### Requirement: Importação aceita qualquer arquivo
A área RCPN do painel DEVE (SHALL) aceitar o envio de arquivos de qualquer extensão, sem
recusar nenhum por formato. Todo arquivo enviado DEVE (SHALL) ser guardado como veio enquanto
a importação estiver aberta, com a data, quem enviou e o hash SHA-256 do conteúdo, e DEVE
(SHALL) ser apagado do painel quando a importação for publicada ou descartada, ficando a data,
quem enviou, o hash e o resultado (decisão de 14/11/2026: o original continua no sistema do
registro civil). Um arquivo idêntico a outro não descartado DEVE (SHALL) ser recusado com a data
do primeiro envio. Arquivos maiores que o limite de envio direto
da hospedagem DEVEM (SHALL) subir direto ao armazenamento, em partes. Nenhum arquivo enviado
DEVE (SHALL) ser executado.

#### Scenario: Formato desconhecido fica guardado
- **WHEN** a serventia envia um arquivo cujo formato o sistema não lê
- **THEN** o arquivo fica guardado, a importação aparece como "guardado, não lido" e a tela orienta exportar do sistema de origem em formato aberto (Access, planilha, CSV, XML)

#### Scenario: Mesmo arquivo enviado duas vezes
- **WHEN** a serventia envia um arquivo com o mesmo conteúdo de um já enviado e não descartado
- **THEN** o sistema avisa que o arquivo já foi recebido, com a data do primeiro envio, e não abre nova importação

### Requirement: Leitura pelo conteúdo e abertura de pacotes
O sistema DEVE (SHALL) reconhecer o formato pelo conteúdo do arquivo, e não só pela extensão.
Pacotes compactados (zip, rar, 7z, tar, gz) DEVEM (SHALL) ser abertos e cada arquivo de dentro
tratado como um envio, com limite de tamanho descompactado e de profundidade. O sistema DEVE
(SHALL) ler, no mínimo: Access (mdb, accdb), dBase (dbf), SQLite, cópia de banco em texto (sql,
lida e nunca executada), planilhas (xlsx, xls, ods, csv), texto separado por delimitador ou em
colunas fixas, XML e JSON. Imagens (tiff, jpg, png) e PDF escaneado DEVEM (SHALL) ser guardados
e poder ser ligados a um registro do índice, sem leitura automática para o índice.

#### Scenario: Pacote com os bancos do Cartosoft
- **WHEN** a serventia envia um .rar com os bancos Access do Cartosoft
- **THEN** o sistema abre o pacote, reconhece cada banco e mostra as tabelas de nascimento, casamento e óbito prontas para conferência

#### Scenario: Pacote maior que o limite descompactado
- **WHEN** um pacote, ao abrir, passa do limite de tamanho
- **THEN** a abertura para, o pacote fica guardado e a tela diz por que não foi aberto

### Requirement: Ligação de colunas salva como modelo
Para toda fonte em forma de tabela, o sistema DEVE (SHALL) permitir ligar cada coluna a um campo
do índice e salvar a ligação como modelo nomeado da fonte. Uma importação seguinte da mesma
fonte DEVE (SHALL) vir com o modelo aplicado. O modelo do Cartosoft (Access) DEVE (SHALL) vir
pronto. Os campos do índice são: tipo de registro, nome do registrado (e, no casamento, os dois
cônjuges e o nome adotado), nome da mãe, nome do pai, data de nascimento, data do registro, do
casamento ou do óbito, livro, folha, termo, matrícula CNJ e profissões, cada uma dizendo de
quem é.

#### Scenario: Sistema novo, ligação uma vez
- **WHEN** a serventia importa uma planilha de um sistema sem modelo e liga as colunas
- **THEN** a ligação fica salva com o nome dado, e a próxima planilha do mesmo sistema já vem ligada

### Requirement: Informações gerais por livro, guardadas só no painel
A leitura DEVE (SHALL) guardar, das informações gerais que a serventia envia do sistema do
registro civil por livro, folha, termo e matrícula (decisão de 14/11/2026), além dos campos do índice, os dados que a certidão imprime (por exemplo hora, local,
sexo, DNV, avós, gêmeos, anotações e averbações; no casamento, regime e qualificação dos
cônjuges; no óbito, hora, local, sepultamento, documento, eleitor, médico e declarante), para a
certidão sair pronta. Usuários, senhas, registros de uso do sistema e as demais tabelas NÃO DEVEM
(SHALL NOT) ser lidos. Esses dados DEVEM (SHALL) ficar só no painel, para quem tem a permissão do
Registro Civil; a consulta pública NÃO DEVE (SHALL NOT) mostrá-los. Campo em branco no arquivo NÃO
DEVE (SHALL NOT) apagar o que o painel já tem.

#### Scenario: Banco completo do Cartosoft
- **WHEN** a serventia envia os bancos NA, CA e OB do Cartosoft
- **THEN** cada registro fica com os dados da certidão, e a certidão de nascimento sai com hora, local, avós, DNV e anotações já preenchidos

### Requirement: Índice de cada livro
O painel DEVE (SHALL) mostrar os livros recebidos por tipo de registro (Livro A, B, B Auxiliar,
C, C Auxiliar e os demais), cada um com o número de registros e o período, e o índice de cada
livro por folha e termo, com o acesso ao registro e à emissão da certidão já preenchida.

#### Scenario: Abrir um livro
- **WHEN** a pessoa abre Registro Civil › Livros › Livro A-12
- **THEN** vê os registros por folha e termo e, ao abrir um deles, a certidão como vai sair, com os campos que faltam marcados para completar com o livro

### Requirement: Conferência antes de publicar
Nenhum registro lido DEVE (SHALL) aparecer na pesquisa ou na consulta pública antes da
conferência. A conferência DEVE (SHALL) mostrar as contagens por tipo de registro e livro, o
período coberto, e listar registros sem nome, sem data de nascimento, sem matrícula ou com
matrícula fora do formato, e duplicados. Uma pessoa com a permissão DEVE (SHALL) publicar,
podendo deixar de fora os registros com problema. Publicar DEVE (SHALL) substituir, pela
matrícula CNJ, a versão anterior do mesmo registro, sem duplicar, e manter o histórico de
importações. A publicação DEVE (SHALL) ser registrada na auditoria.

#### Scenario: Reimportação do mesmo banco
- **WHEN** a serventia publica de novo um banco já publicado, com alguns registros corrigidos
- **THEN** os registros com a mesma matrícula são atualizados, nenhum é duplicado e o histórico mostra as duas importações

#### Scenario: Registros com problema ficam de fora
- **WHEN** a conferência mostra registros sem data de nascimento e a pessoa publica sem eles
- **THEN** só os registros completos entram no índice, e os deixados de fora continuam listados na importação

### Requirement: Pesquisa interna do RCPN
A área RCPN DEVE (SHALL) oferecer pesquisa no índice por nome do registrado, nome da mãe, data
de nascimento, livro, folha, termo ou matrícula, tolerante a acentos, maiúsculas e pequenas
diferenças de grafia. O resultado DEVE (SHALL) mostrar o registro com as profissões, os
casamentos e óbitos ligados, as imagens de folha ligadas, e de que importação veio. A área DEVE
(SHALL) mostrar o período coberto pelo índice, para quem pesquisa saber o que ele não alcança.

#### Scenario: Grafia diferente no balcão
- **WHEN** a pessoa pesquisa um nome com uma letra trocada
- **THEN** o registro aparece entre os resultados, marcado como semelhante

### Requirement: Permissões da área RCPN
A área RCPN DEVE (SHALL) ter duas permissões próprias em Perfis e permissões: "RCPN:
pesquisar" e "RCPN: importar arquivos". Sem a primeira, a área não aparece; sem a segunda, o
envio, a ligação de colunas, a conferência, a publicação e o acesso aos arquivos originais não
aparecem.

#### Scenario: Pessoa só com pesquisa
- **WHEN** uma pessoa com "RCPN: pesquisar" e sem "RCPN: importar arquivos" abre a área
- **THEN** ela vê a pesquisa e não vê o envio, a conferência nem os arquivos originais

### Requirement: Registro que já existe no índice
A cada envio, a conferência DEVE (SHALL) comparar cada registro com o índice pela matrícula
(ou livro, folha e termo, sem matrícula) e separar: novo, já no índice sem mudança, e já no
índice com dados diferentes. O registro com dados diferentes DEVE (SHALL) ser mostrado com o
valor do índice e o do arquivo, campo a campo, e só DEVE (SHALL) ser substituído se a pessoa o
marcar (decisão de 14/11/2026). Campo em branco no arquivo NÃO DEVE (SHALL NOT) apagar o que o
índice já tem.

#### Scenario: Envio diário com um registro corrigido
- **WHEN** o arquivo traz um registro novo e outro já indexado com o nome da mãe corrigido
- **THEN** a conferência mostra 1 novo e 1 com dados diferentes, com "mãe: antigo → novo", e publicar sem marcar grava só o novo

#### Scenario: Carga sem profissão
- **WHEN** a carga XML traz um registro já indexado, igual em tudo, mas sem a profissão
- **THEN** o registro conta como sem mudança e a profissão do índice continua lá

### Requirement: Natimortos dentro de óbitos
O índice DEVE (SHALL) reconhecer como natimorto o óbito registrado no Livro C Auxiliar (Lei
6.015/1973, art. 33, V, e art. 53, § 1º) e mostrá-lo como subdivisão de Óbitos: contagem própria
nos quadros do índice e da conferência, e "Óbito · Natimorto" no resultado da pesquisa.

#### Scenario: Óbito do Livro C Auxiliar
- **WHEN** um óbito importado é do livro "C AUX 1"
- **THEN** ele conta em Óbitos e na linha "natimortos (Livro C Auxiliar)", e a pesquisa o mostra como "Óbito · Natimorto"

### Requirement: Explicações com "!" e lugar na barra lateral
Cada tela da área RCPN DEVE (SHALL) ter o "!" ao lado do título, explicando para que serve, como
usar e os termos (índice, matrícula, livros A, B, C e C Auxiliar, natimorto, semelhante,
profissão declarada, novo, alterado, pendência), e os quadros do que o índice tem DEVEM (SHALL)
ter um "!" próprio. A área DEVE (SHALL) ficar no grupo "Atribuições" da barra lateral (decisão de
14/11/2026), onde as demais atribuições da serventia entram quando suas telas existirem.

#### Scenario: Escrevente sem saber o que é Livro C Auxiliar
- **WHEN** a pessoa abre o "!" ao lado de "O que o índice tem"
- **THEN** lê que o natimorto é registrado no Livro C Auxiliar e aparece dentro de Óbitos
