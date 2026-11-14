## ADDED Requirements

### Requirement: Importação aceita qualquer arquivo
A área RCPN do painel DEVE (SHALL) aceitar o envio de arquivos de qualquer extensão, sem
recusar nenhum por formato. Todo arquivo enviado DEVE (SHALL) ser guardado como veio, com a
data, quem enviou e o hash SHA-256 do conteúdo; um arquivo idêntico já guardado DEVE (SHALL)
ser reconhecido como repetido, sem nova cópia. Arquivos maiores que o limite de envio direto
da hospedagem DEVEM (SHALL) subir direto ao armazenamento, em partes. Nenhum arquivo enviado
DEVE (SHALL) ser executado.

#### Scenario: Formato desconhecido fica guardado
- **WHEN** a serventia envia um arquivo cujo formato o sistema não lê
- **THEN** o arquivo fica guardado, a importação aparece como "guardado, não lido" e a tela orienta exportar do sistema de origem em formato aberto (Access, planilha, CSV, XML)

#### Scenario: Mesmo arquivo enviado duas vezes
- **WHEN** a serventia envia um arquivo com o mesmo conteúdo de um já guardado
- **THEN** o sistema avisa que o arquivo já foi recebido, com a data do primeiro envio, e não guarda segunda cópia

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

### Requirement: Só os campos do índice entram
A leitura DEVE (SHALL) extrair apenas os campos do índice e descartar todos os demais,
incluindo CPF, RG, CTPS, PIS, número de benefício, causa da morte, médico, cor, telefones,
endereços e dados de usuários e senhas do sistema de origem. O arquivo original DEVE (SHALL)
ficar acessível só no painel, a quem tem a permissão de importar.

#### Scenario: Banco com CPF e causa da morte
- **WHEN** o banco de óbitos importado traz CPF e causa da morte
- **THEN** o índice guarda nome, datas, livro, folha, termo, matrícula e profissão, e não guarda CPF nem causa da morte

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
