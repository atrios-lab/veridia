## MODIFIED Requirements

### Requirement: Declaração de hipossuficiência em PDF
O pedido de gratuidade DEVE (SHALL) produzir, além do requerimento, a **declaração de
hipossuficiência econômica** em PDF, fiel ao Anexo I do Provimento CGJ/TJRN n. 7/2026 tal como
publicado no DJe, com a identidade visual da serventia e o layout de formulário aprovado (blocos
numerados em cartão, campos em colunas, caixas de marcação desenhadas, avisos destacados,
cabeçalho compacto a partir da segunda página, "Nº do pedido" no timbre e "Página X de Y" no
rodapé). O conteúdo DEVE (SHALL) seguir a letra do Anexo I oficial, e onde o layout aprovado e
o Anexo I divergirem, DEVE (SHALL) prevalecer o Anexo I:

- aviso "Antes de preencher" e aviso "Proteção de dados" com o texto oficial;
- (1) dados da serventia, preenchidos com o nome e o município do tenant, sem CNS;
- (2) dados da pessoa beneficiária, com CPF ou RG num campo só;
- (3) os quatro itens do oficial ("Certidão de nascimento, casamento, óbito ou outra",
  "Habilitação, registro do casamento e primeira certidão", "Alteração extrajudicial de prenome
  e gênero (Retificação e Averbação), inclusive certidões correspondentes", "Outro ato com
  previsão legal"), sem base legal ao lado, com o ato-alvo do pedido marcado e "Outro ato" e
  a descrição sempre em branco; o tipo de certidão como "Sem busca", "Com busca" e "Inteiro
  teor"; Livro, Folha e Termo em branco;
- (4) a declaração e as ciências (a) a (e);
- (5) "Local, data e assinatura da pessoa interessada", com local e data e a linha de
  assinatura, sem nenhuma informação sobre o aceite eletrônico dentro do bloco;
- (6) representante legal ou assistente, com a frase fixa do oficial, preenchido só quando
  houver;
- (7) assinatura a rogo, com a frase fixa do oficial e o espaço para a impressão digital,
  preenchida só quando houver;
- (8) testemunhas com nome, CPF ou RG e telefone ou e-mail, sem linha de assinatura,
  preenchidas quando o balcão as colheu e em branco caso contrário;
- (9) certificação da presença, com a frase fixa do oficial, sempre em branco para o oficial;
- a base normativa do rodapé exatamente como publicada no DJe.

Todo campo não coletado DEVE (SHALL) sair como linha em branco, para preenchimento à mão. Na
habilitação de casamento o arquivo DEVE (SHALL) trazer uma declaração por nubente.

Depois do bloco 9, a declaração gerada de um pedido DEVE (SHALL) trazer o **carimbo de
certificação de recebimento eletrônico**, visualmente separado dos nove blocos e rotulado como
emitido pela plataforma e não integrante do Anexo I, com: canal (site oficial da serventia,
balcão ou atendimento por chat), data e hora do aceite, quem formalizou, protocolo, o texto de
recebimento pela Plataforma Eletrônica Oficial da Serventia mediante aceite do texto integral do
Anexo I, o texto institucional da plataforma com remissão ao art. 208, II, "b", do Código
Nacional de Normas da Corregedoria Nacional de Justiça – Foro Extrajudicial, na redação do
Provimento CNJ n. 180/2024, a linha "Autenticidade • Integridade • Segurança • Rastreabilidade",
o hash SHA-256 do conteúdo aceito e o endereço IP do aceite (em branco quando não gravado). O
carimbo NÃO DEVE (SHALL NOT) afirmar que o Provimento CGJ/TJRN n. 7/2026 autoriza a plataforma.
O rodapé da declaração gerada de um pedido DEVE (SHALL) trazer também a linha "Documento
expedido pela Plataforma Eletrônica Oficial da Serventia · Provimento CNJ nº 180/2024 · Dados
tratados conforme a LGPD (Lei nº 13.709/2018)".

A declaração DEVE (SHALL) ser baixável pelo cidadão na tela de sucesso e na consulta do protocolo,
com a mesma chave de acesso que protege o requerimento, e SÓ DEVE (SHALL) ser oferecida em pedido
que tenha gratuidade. Ela NÃO DEVE (SHALL NOT) fazer parte do requerimento nem de nenhum outro
documento. O requerimento e o comprovante de acesso NÃO DEVEM (SHALL NOT) mudar de aparência
por causa desta declaração.

#### Scenario: A declaração sai preenchida com o que foi coletado
- **WHEN** o cidadão baixa a declaração de um pedido de gratuidade feito pela própria pessoa
- **THEN** o PDF traz a serventia, o beneficiário, o ato marcado no bloco 3 na letra do oficial,
  a declaração e as ciências, com os blocos 8 e 9 em branco e sem os blocos 6 e 7

#### Scenario: A certidão marca o tipo com o rótulo oficial
- **WHEN** o cidadão baixa a declaração de um pedido cujo ato-alvo é a certidão sem busca
- **THEN** o bloco 3 marca "Certidão…" e, abaixo, "Sem busca"; "Com busca", "Inteiro teor" e
  "Outro ato com previsão legal" saem desmarcados e a descrição em branco

#### Scenario: A rogo sai com quem assina e testemunhas em branco
- **WHEN** o cidadão baixa a declaração de um pedido feito a rogo pelo site
- **THEN** o bloco 7 traz a frase oficial, quem assina e o espaço da impressão digital, e o
  bloco 8 traz as duas testemunhas com nome, CPF ou RG e telefone ou e-mail em branco

#### Scenario: Habilitação traz duas declarações
- **WHEN** o cidadão baixa a declaração de um pedido de gratuidade da habilitação de casamento
- **THEN** o arquivo traz uma declaração completa por nubente, cada uma com o próprio carimbo

#### Scenario: O carimbo diz por onde, quando, quem e sob qual norma
- **WHEN** o cidadão ou o operador baixa a declaração de um pedido feito pelo site
- **THEN** depois do bloco 9 aparece o carimbo com canal "Site oficial da serventia", a data e a
  hora do aceite, "A própria pessoa" (ou o representante ou quem assina a rogo, nomeado), o
  protocolo, os dois textos da plataforma, a linha de autenticidade, o hash e o IP, e o rodapé
  traz a linha da Plataforma Eletrônica Oficial

#### Scenario: O carimbo no pedido do balcão
- **WHEN** o operador imprime a declaração de um pedido lançado no balcão
- **THEN** o carimbo sai com canal "Balcão", a data e a hora do lançamento, o hash e a linha do
  IP em branco

#### Scenario: O bloco 5 fica como o oficial
- **WHEN** qualquer declaração é gerada
- **THEN** o bloco 5 traz só local e data e a assinatura da pessoa interessada; a informação do
  aceite eletrônico aparece apenas no carimbo

#### Scenario: Pedido antigo sem IP
- **WHEN** o operador imprime a declaração de um pedido protocolado antes de o IP ser gravado
- **THEN** o carimbo sai completo, com a linha do IP em branco, sem erro e sem dado inventado

#### Scenario: Só com a chave, e só quando há gratuidade
- **WHEN** a rota da declaração é chamada sem a chave de acesso correta, ou para um pedido sem
  gratuidade
- **THEN** a resposta nega, sem gerar documento, e a tela não oferece o botão em pedido sem
  gratuidade

### Requirement: Formulário de declaração em branco disponível sem pedido
O site DEVE (SHALL) oferecer o formulário da declaração de hipossuficiência em branco, em PDF
com a identidade visual da serventia, sem exigir pedido, chave ou sessão, a partir da tela do ato
da gratuidade e da lista de atos do Registro Civil. É o mesmo documento da declaração
preenchida, com o mesmo layout e todos os campos em branco, os blocos 6 e 7 presentes, **sem o
carimbo de certificação**, sem a linha da plataforma no rodapé e com a linha "Nº do pedido" em
branco no timbre.

#### Scenario: O cidadão imprime o formulário para preencher antes
- **WHEN** o cidadão abre o link do formulário em branco na tela da gratuidade
- **THEN** recebe o PDF do Anexo I em branco, com a serventia e o município já preenchidos, os
  nove blocos presentes, e nenhum carimbo

#### Scenario: Sem RCPN, sem formulário
- **WHEN** a rota do formulário em branco é chamada num tenant sem a atribuição RCPN
- **THEN** a resposta é "não encontrado"

## ADDED Requirements

### Requirement: Registro do aceite eletrônico da declaração
Quando um pedido de gratuidade é protocolado pelo site, o sistema DEVE (SHALL) gravar, junto da
declaração, o endereço IP de quem aceitou (primeiro salto do cabeçalho de encaminhamento da
requisição), ao lado da data e hora do aceite que já são gravadas. O IP DEVE (SHALL) ser gravado
só na declaração de hipossuficiência, nunca nos aceites de LGPD e veracidade do requerimento nem
em pedidos sem gratuidade. O balcão NÃO DEVE (SHALL NOT) gravar IP: o aceite presencial é o papel
assinado. Finalidade e base legal do tratamento constam da proposta desta mudança.

O sistema DEVE (SHALL) calcular, de forma determinística e sem depender de segredo, um hash
SHA-256 do conteúdo aceito: serventia, protocolo, data e hora do aceite, ato-alvo, tipo de
certidão, beneficiários (sem testemunhas e sem desfecho), o texto da declaração e as cinco
ciências na redação aceita. Dois pedidos com o mesmo conteúdo DEVEM (SHALL) produzir hashes
diferentes (o protocolo e o instante entram). Uma mudança na redação do texto da declaração DEVE
(SHALL) mudar o hash, e o código DEVE (SHALL) documentar que isso invalida a conferência de hashes
antigos.

#### Scenario: O aceite pelo site grava o IP
- **WHEN** o cidadão protocola um pedido de gratuidade pelo site
- **THEN** o registro carrega, na declaração, o IP de quem aceitou, além da data e hora

#### Scenario: Pedido sem gratuidade não grava IP
- **WHEN** o cidadão protocola pelo site um pedido de ato sem gratuidade
- **THEN** nenhum IP é gravado no registro

#### Scenario: O balcão não grava IP
- **WHEN** o operador lança no balcão um pedido de gratuidade
- **THEN** a declaração é gravada sem IP

#### Scenario: O hash é recalculável a partir do pedido
- **WHEN** o hash é calculado duas vezes sobre o mesmo pedido
- **THEN** o resultado é o mesmo, e difere do hash de outro pedido com os mesmos beneficiários

#### Scenario: Pedido antigo continua válido
- **WHEN** o sistema lê a declaração de um pedido gravado antes de o IP existir
- **THEN** a leitura funciona e o IP vem ausente
