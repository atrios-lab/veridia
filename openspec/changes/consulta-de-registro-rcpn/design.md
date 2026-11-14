## Context

O banco enviado pela serventia (`BancoDeDados.rar`, análise de 14/11/2026, só estrutura e
contagens, nenhum dado copiado) é do Cartosoft antigo, em Microsoft Access (`.mdb`, JET4),
com arquivos de 04/02/2016:

| Arquivo | Conteúdo | Uso aqui |
|---|---|---|
| `NA.mdb` | `NASCIMENTO` (2.561), `NA_PAIS`, `NA_ANOAVE`, `NA_LOG`... | índice de nascimento |
| `CA.mdb` | `CASAMENTO` (787), `CA_PAIS`, `CA_COMPLEMENTO`... | índice de casamento |
| `OB.mdb` | `OBITO` (187), `OB_PAIS`, `OB_CAUSA_MORTE`... | índice de óbito |
| `LIVROE.MDB`, `DLIVROE.MDB` | Livro E (emancipação, interdição, ausência, transcrições) | futuro; tabelas vazias neste banco |
| `FI.mdb` | selos, caixa, lançamentos | não importa |
| `RC.mdb` | configuração, usuários e senhas, tabela de cartórios | **nunca importa** (senhas) |
| `*.ldb`, `_cart&.lic` | trava do Access, licença | ignorados |

Campos que interessam, por livro:

- **Nascimento:**
  - `NASCIMENTO.no_pessoa`, `dt_nascimento` (texto `dd/mm/aaaa`, formato único), `nu_livro`,
    `nu_folha`, `cd_registro`, `dt_registro`, `nu_matriculaCNJ`;
  - `NA_PAIS.NO_MAE`, `NO_PAI`, `no_profiss_pai`, `no_profiss_mae` (ligados por `ID`).
- **Casamento:** `no_noivo`, `no_noiva`, `no_noiva_casada`, `dt_nasc_noivo`, `dt_nasc_noiva`,
  `profissao_noivo`, `profissao_noiva`, `dt_casamento`, `nu_livro`, `nu_folha`,
  `nu_registro`, `nu_matriculaCNJ`; pais em `CA_PAIS`.
- **Óbito:** `no_pessoa`, `dt_nascimento`, `no_profissao`, `dt_falecimento`, `nu_livro`,
  `nu_folha`, `nu_registro`, `nu_matriculaCNJ`; pais em `OB_PAIS`.

Achados que mudam o desenho:

- **Profissão:** cerca de 11% (pai) e 12% (mãe) no nascimento, cerca de 60% no casamento,
  cerca de 98% no óbito.
- **Anotações:** `NA_ANOAVE.TEXTO` traz testemunhas em quase todos os casos; só cerca de 15
  textos são averbações.
- **Ligações:** os casamentos não apontam para o nascimento dos noivos de forma que bata com
  o índice. Os óbitos parecem apontar (`nu_reg_na`), a confirmar.
- **Período:** registros de 1954 a 2016, concentrados depois de 1970. Faltam os de 2016 em
  diante e, provavelmente, parte dos antigos.

## Goals / Non-Goals

**Goals:**
- O painel aceita qualquer arquivo e lê o máximo de formatos possível. Nada é recusado nem
  perdido.
- Um índice confiável, conferido por uma pessoa antes de publicar, sem duplicar em
  reimportação.
- Uma consulta pública que responde na hora o que os dados permitem, sem afirmar o que eles
  não sustentam.
- Proteger o tabelião: a resposta não vale como certidão, quem consulta fica identificado e
  toda consulta fica registrada.

**Non-Goals:**
- Emitir certidão pelo portal (mudança futura).
- Ler texto de imagem (OCR) para dentro do índice. A imagem fica guardada e ligada; um OCR
  futuro só sugere, e uma pessoa confere.
- Substituir o sistema do registro civil. O índice é cópia de leitura, alimentada por
  importação.

## Decisions

### 1. Aceitar é diferente de ler: guardar sempre, ler o que der

Todo envio é guardado como veio, com hash SHA-256 (impressão digital) para não duplicar, data
e quem enviou. Depois o pipeline tenta ler. O que não conseguir ler fica "guardado, não lido",
com orientação de exportação. Alternativa: aceitar só uma lista de extensões. Descartada: o
dono do projeto pediu todos os formatos, e recusar um arquivo é perder o que a serventia tinha
em mãos.

### 2. Reconhecer pelo conteúdo, não pela extensão

A extensão engana (`.txt` que é CSV, `.dat` que é dBase). Os leitores são escolhidos pela
assinatura do arquivo (os primeiros bytes) e, na falta dela, pela estrutura do texto. Pacotes
(`.zip`, `.rar`, `.7z`, `.tar`, `.gz`) são abertos, e cada arquivo de dentro segue o mesmo
caminho, com limite de tamanho descompactado e de profundidade contra pacote malicioso.
Nenhum arquivo é executado.

Formatos que leem dados: Access (`.mdb`, `.accdb`), dBase/FoxPro (`.dbf`), SQLite, cópia
`.sql` (só `INSERT`, nunca executada), planilhas (`.xlsx`, `.xls`, `.ods`, `.csv`), texto
separado (`;`, `,`, `|`, tabulação) ou em colunas fixas, XML e JSON. Formatos fechados de
fabricante (por exemplo Firebird `.fdb`, SQL Server `.bak`/`.mdf`, e o `.sys` citado pela
serventia até termos amostra) ficam guardados, com aviso.

### 3. Ligação de colunas como modelo salvo

Qualquer fonte em tabela vira "colunas", e uma pessoa liga cada coluna a um campo do índice:
nome, mãe, pai, nascimento, livro, folha, termo, matrícula, profissões, datas. A ligação fica
salva como modelo da fonte ("Cartosoft (Access)"), e a próxima importação da mesma fonte já
vem ligada. O modelo do Cartosoft (Access) vem pronto, a partir da análise acima. É isso que
torna "qualquer formato" sustentável: um sistema novo não depende de programador.

### 4. Conferência antes de publicar

Igual ao boletim: o sistema mostra o que leu, com contagens por livro, registros sem nome, sem
data ou com matrícula fora do formato, e duplicados. Uma pessoa com a permissão publica.
Registros com problema podem ficar de fora. Publicar substitui, pela matrícula CNJ, a versão
anterior do mesmo registro, sem apagar o histórico de importações.

### 5. Minimização: só os campos do índice entram

A leitura descarta tudo que não é campo do índice: CPF, RG, CTPS, PIS, benefício do INSS, causa
da morte, médico, cor, telefones, endereços, usuários e senhas. O arquivo original fica
guardado só no painel, para reimportação e auditoria. Nenhum dado real entra em teste ou
código (LGPD; regra do projeto).

### 6. Consulta pública: correspondência exata e só o que foi encontrado

A comparação ignora acentos, maiúsculas, espaços repetidos e "de/da/do/dos/das" no meio do
nome. Os três dados precisam bater. Não há sugestão de nomes parecidos, porque isso
revelaria o nome de outra pessoa. A tolerância a grafia existe só na pesquisa do painel.

A resposta afirma apenas o que foi encontrado:

- a profissão, dizendo de quem é;
- casamento ou óbito no índice com o mesmo nome e a mesma data de nascimento.

A resposta nunca afirma ausência ("não é casado", "não consta profissão"):

- profissão vazia vira "não está nos dados digitais; o livro pode trazer", com o pedido de
  busca;
- qualquer resposta traz o aviso de que a certidão sai com todas as anotações e averbações.

### 7. Identificação de quem consulta e auditoria

Quem consulta informa nome, CPF (validado pelos dígitos), OAB quando advogado, e a finalidade
de uma lista, e marca a declaração de uso só para ela. Cada consulta fica registrada:

- o que foi perguntado e o que foi respondido, sem a resposta completa;
- quem perguntou, a finalidade e o IP com hash.

O limite de tentativas segue o padrão de `/verificar`. A finalidade declarada é a base do
tratamento na LGPD, e o registro protege o tabelião se um dia questionarem o acesso.

### 8. Encaminhamento aos pedidos existentes

Os botões abrem `rcpn-certidao`, `rcpn-certidao-inteiro-teor` ou `rcpn-busca` já preenchidos:

- com o registro localizado, levam o tipo, o livro, a folha e o termo (ou a matrícula) em
  campo oculto, que o cartório vê no pedido;
- sem registro localizado, levam os dados consultados.

O que cada ato exige não muda: o inteiro teor continua pedindo a qualificação de quem pede.

## Risks / Trade-offs

- **Índice incompleto diz "não localizado" a quem é registrado aqui** → texto que nunca afirma
  inexistência, e pedido de busca sempre oferecido. A área RCPN mostra o período coberto pelo
  índice.
- **Erro de leitura publicado** → conferência humana obrigatória antes de publicar.
- **Varredura da base pela consulta pública** → correspondência exata dos três dados,
  identificação de quem consulta, limite de tentativas e auditoria.
- **Base de registrados na nuvem** → minimização, armazenamento privado, acesso por permissão,
  e registro no inventário de LGPD da serventia.
- **Consulta gratuita versus custas da busca** → decisão do dono do projeto (14/11/2026). A
  busca manual (`rcpn-busca`) segue como hoje para o que o índice não responde.

## Migration Plan

- Migração só acrescenta tabelas, sem tocar nas existentes.
- Rollback: desligar a página pública (gating da seção) e a área RCPN. Os dados ficam.

## Carga em XML (análise de 14/11/2026)

O arquivo `NA_INC_20250902_1.xml` (nascimento, inclusão, 02/09/2025, um registro) segue o
leiaute de carga `CARGAREGISTROS`:

- `VERSAO`, `ACAO`, `CNS`;
- `MOVIMENTONASCIMENTOTN/REGISTRONASCIMENTOINCLUSAO`, com nome, CPF do registrado, matrícula,
  data do registro, DNV, data e hora de nascimento, local, sexo, gêmeos, município IBGE e
  nacionalidade;
- `FILIACAONASCIMENTO`, com nome, sexo, data de nascimento, idade, endereço e naturalidade de
  cada genitor;
- `DOCUMENTOS` e `OBSERVACOES`.

Pelo nome e pela estrutura, é a carga que a serventia envia à central do registro civil, a
confirmar com ela. Três consequências:

- **Esta carga não tem profissão.** O XML de carga traz os dados para a central, não a
  profissão dos pais. A profissão continua vindo do banco do Cartosoft (ou de exportação
  própria dele). O leitor de XML entra no índice com nome, mãe, nascimento e matrícula, e a
  profissão fica vazia quando a fonte for só o XML. A resposta pública já trata isso (nunca
  afirma ausência).
- **A mãe não vem marcada como mãe.** A filiação vem numa lista com `SEXO` e
  `INDICEFILIACAO`. O modelo de ligação precisa de uma regra para identificar a mãe; uma
  filiação com duas mães ou dois pais não pode quebrar a leitura.
- **Cargas incrementais.** `ACAO` (inclusão) e o nome do arquivo por data indicam cargas por
  movimento. A importação precisa aceitar muitos arquivos pequenos, um por movimento, e tratar
  inclusão e alteração pela matrícula.

O arquivo `WR_CPF_..._2016_...xml` segue o leiaute `InscricaoCPF`. Pelos campos, é o pedido de
inscrição de CPF feito no ato do registro:

- traz CNS, tipo de operação, nome, nome da mãe, nome do pai, data de nascimento (`AAAAMMDD`),
  sexo, naturalidade, endereço, matrícula, e CPF da mãe e do pai;
- dá nome, mãe, nascimento e matrícula para o índice, sem profissão;
- endereço e CPFs são descartados na leitura (decisão 5);
- a data vem em outro formato (`AAAAMMDD`, não `dd/mm/aaaa`), e o leitor precisa normalizar.

O pacote `24_SISCART_04606_05_01_2017_...zip` está protegido por senha. Ele contém
`Controlesc.sis`, `rc_nv.txt`, `rc_cas.txt`, `rc_obt.txt`, `rc_obtf.txt` e `Recibo_SC.pdf`.
Pelos nomes, parece ser a remessa estatística do registro civil (nascidos vivos, casamentos,
óbitos, óbitos fetais); "24" é o código IBGE do RN. O `.sis` deve ser o ".sys" citado pela
serventia. Com a senha, dá para confirmar o leiaute.

Mais quatro XMLs (`NA6650`, `NA17198`, `NA930`, `CA485`) têm a raiz `certidao`. É a
certidão on-line da CRC gerada pelo Cartosoft, com:

- dados da certidão (nome, matrícula, filiação, avós, DNV, observações e averbações);
- o selo (`num_selo`, `cod_selo`, `desc_selo`) e `codigo_hash`;
- anotações de cadastro (CPF, título de eleitor, documentos);
- campos de rejeição.

Esses XMLs também não trazem profissão.

O `eProclamas-0.XML` (`edital_proclama`, versão 1.3) é o edital de proclamas eletrônico. Ele
traz a ocupação dos dois noivos (`texto_livre_ocupacao_conjuge_1` e `_2`), a filiação e o
novo nome: é mais uma fonte de profissão no casamento.

**Codificação:** todos declaram UTF-8 e vêm em Windows-1252. O leitor de XML precisa
detectar a codificação real e não confiar na declaração; senão, recusa o arquivo.

## Modelos de casamento e habilitação (análise de 14/11/2026)

A serventia enviou cerca de 50 modelos do processo de casamento, para uma mudança futura de
habilitação:

- edital de proclamas (próprio e para outro cartório), certidões de edital e certificado de
  habilitação;
- consentimentos, declarações dos contraentes (analfabeto, divorciado ou viúvo, com ou sem
  pacto, residência, dia e hora, mudança de horário);
- petição ao juiz de paz e capa do processo;
- livros de casamento: civil, religioso com efeito civil, remissão recíproca, conversão de
  união estável;
- comunicações de casamento ao registro de nascimento e de casamento anterior;
- certidões pelo Provimento CNJ 63/2017, inclusive inteiro teor, isenta e com selo.

Citam o Código Civil e a Lei 6.015. Três ainda trazem Minas Gerais: o edital para outro
cartório, a petição de conversão de união estável e o selo eletrônico da certidão. Um modelo
é próprio da serventia (edital de proclamas "IM"). A mesma regra vale: texto normativo de MG
não vai para documento do RN.

**Cuidado com material real:** um dos arquivos do lote não era modelo. Era um documento de
trabalho com dados reais de pessoas, inclusive dado de saúde. A cópia de análise foi apagada;
nada dele entrou no repositório. Modelos para a plataforma devem vir sempre em branco (com os
campos `<%...%>`).

## Modelos de certidão do Cartosoft (análise de 14/11/2026)

Esta seção registra, para a mudança futura de emissão, o que os modelos mostram. Foram 29
modelos RTF enviados pela serventia, todos de preenchimento: nenhum traz dado de pessoa.

- **Grupos:**
  - certidões de nascimento, casamento e óbito, em versões impressa e digital, esta com selo;
  - Livro E: registro, certidão e comunicação de emancipação, interdição e ausência;
  - transcrições: óbito e casamento estrangeiros, 1ª e 2ª vias e com averbação, e
    transcrição de certidão de estado civil.
- **Marcação dos campos:** `<%[prefixo]tabela.campo!formato!{sufixo}##%>`.
  - O prefixo e o sufixo só saem quando o campo tem valor.
  - `!3!` e `!8!` são formatos de data.
  - `fx...` são funções do sistema: cidade, data de hoje, oficial, estado civil por extenso.
  - As tabelas e os campos são os mesmos do banco Access (`e_transcricao_obito.no_pessoa`,
    `e_emancipacao.dataeman`; as certidões usam a visão `cv_nascimento`, `cv_casamento` e
    `cv_obito`). O banco é, portanto, a fonte de dados das certidões.
- **Estrutura das certidões:** os rótulos seguem o modelo nacional padronizado. Por exemplo:
  NOME, MATRÍCULA, DATA DE NASCIMENTO POR EXTENSO, FILIAÇÃO, AVÓS, GÊMEO, NÚMERO DA DNV,
  OBSERVAÇÕES/AVERBAÇÕES; no óbito, CAUSA DA MORTE, DECLARANTE e MÉDICO.
- **Os modelos são de Minas Gerais, não do Rio Grande do Norte.** Os textos fixos citam o
  "§ 2º do artigo 609 do Provimento nº 260/2013 da CGJ-MG", a "Central de Registro Civil de
  Minas Gerais" e o selo do TJMG (`selos.tjmg.jus.br`). Os do Livro E trazem "Estado de Minas
  Gerais" e valores de emolumentos antigos digitados no texto. Para a serventia do RN, todo
  texto normativo, o selo e os valores precisam vir da norma do TJRN e da CGJ-RN, conferidos
  na fonte. Copiar o texto de MG numa certidão do RN seria fundamentar o ato em norma de outro
  estado.
- **A certidão precisa de mais dados que o índice.** A certidão de óbito traz causa da morte,
  declarante e médico, que o índice descarta (decisão 5). Para emitir, a mudança futura terá
  de ler o registro completo, só no painel e só na hora de emitir: do arquivo original
  guardado, ou de uma camada restrita própria. Isso fica para aquela mudança decidir.

## Modelos em uso no RN: nascimento e óbito (análise de 14/11/2026)

Os pacotes de nascimento e óbito são diferentes dos modelos de MG, e são a base certa para a
emissão futura:

- **Nascimento:** 61 modelos, todos com campos:
  - livros, inclusive a rogo, adoção, mãe solteira, mandado, adulto e remissão recíproca;
  - certidões pelo Provimento CNJ 63/2017 e pelo "Prov. 182", paga, isenta, 2ª via, inteiro
    teor e verbum ad verbum;
  - declarações de mãe solteira, requerimentos de registro tardio, comunicações, termos de
    abertura e encerramento.
- **Óbito:** 43 modelos (certidões, livros, termos, comunicações).
- **Já trazem o texto do RN.** Os trechos abaixo vêm dos próprios modelos e precisam ser
  conferidos na fonte antes de usar:
  - a estampa "Selo Digital de Fiscalização … Confira em: https://selodigital.tjrn.jus.br";
  - a discriminação de valores (emolumento, ISSQN, taxa de fiscalização e fundos), com valores
    digitados no texto;
  - a isenção "conforme Art. 10 do Provimento 07/2026 da CGJ/TJRN";
  - a dispensa de custas da "Portaria Conjunta nº 10 - TJRN de 04/03/2022".
- **Valores e normas vêm da configuração, nunca de texto fixo.** Valores digitados num modelo
  envelhecem a cada tabela nova. Na plataforma, os valores saem da tabela de emolumentos
  vigente e as normas da configuração da serventia.
- **Onde está a profissão**, confirmando a análise do banco: `na_pais.no_profiss_pai`,
  `na_pais.no_profiss_mae`, `obito.no_profissao`, `ob_pais.profiss_pai` e `_mae`. Os modelos
  também usam a profissão do declarante e das testemunhas (`na_declarante.no_profissao`,
  `na_testemunha.profissao_*`, `ob_declarante.profissao`). Essas a consulta não mostra; a
  leitura descarta (decisão 5).
- Um modelo de livro ainda tem o nome de um município de MG no título: sobra dos modelos de
  origem.

## Manuais da CRC e do selo do TJRN (análise de 14/11/2026)

Registrado para a mudança futura de emissão. Fontes: manuais do Cartosoft enviados pela
serventia, "Certidão On-line da CRC Nacional" (v1.0, 16/04/2018) e "Selo Digital - manual do
usuário" do RN (v1.0, 23/05/2019). Vale conferir se há versão mais nova.

- **Certidão on-line pela CRC Nacional:**
  - o pedido chega pela CRC Nacional (sistema.registrocivil.org.br), acessada só com
    certificado digital A3 válido;
  - a serventia gera no seu sistema um XML da certidão para o número do pedido e o
    encaminha à serventia solicitante pela própria CRC.
  - É o canal oficial entre serventias. O manual não diz se a serventia pode emitir certidão
    eletrônica por portal próprio. Essa dúvida continua aberta e precisa da norma.
- **Selo digital do TJRN (SIEX, selodigital.tjrn.jus.br):**
  - O titular ou o substituto pede no SIEX lotes de selos, um de isentos e um de normais
    (pagos), com login do TJRN e certificado digital. Baixa o lote em XML e dá carga no
    sistema do cartório.
  - Cada ato consome um selo, escolhendo a tabela da atribuição, pago ou isento, e o código
    do ato.
  - A certidão leva a estampa: "Poder Judiciário do RN", "Selo Digital de Fiscalização", a
    serventia, o tipo (normal ou isento), o código do selo e "Consulte a validade no site:
    https://selodigital.tjrn.jus.br".
  - Todo selo usado precisa ser comunicado ao TJRN, por remessa em XML enviada ao SIEX.
  - No casamento, o mesmo selo acompanha da habilitação à celebração, com atualização de
    status comunicada ao SIEX.
- **Consequência para a emissão pela plataforma.** Emitir certidão com selo exige que a
  plataforma:
  - importe lotes de selos do SIEX;
  - consuma um selo por ato, com o código do ato e pago ou isento;
  - imprima a estampa;
  - gere a remessa de utilizados para o SIEX.
  O ponto crítico é que o Cartosoft continua consumindo selos. Dois sistemas consumindo o
  mesmo lote geram risco de selo usado duas vezes. A mudança futura terá de decidir: lote
  separado só para a plataforma, ou a plataforma como única controladora de selos dos atos
  que emite. A consulta de selo já existente (`/selo`, TJRN) ajuda na conferência pelo
  cidadão.

## Open Questions

- **Banco atual:** existe um banco do Cartosoft posterior a 2016? Em que formato? O analisado
  vai só até fevereiro de 2016.
- **Arquivo `.sys`:** formato a confirmar com amostra.
- **Casamento e óbito na resposta:** a proposta mostra só o que for encontrado, com aviso.
  Falta confirmação final do dono do projeto.
- **Profissão pela parentalidade:** a consulta deve aceitar "sou pai ou mãe no registro" (o
  caso comum da aposentadoria rural), além de "sou o registrado"?
- **Lista de finalidades** da consulta pública.
- **Certidão pelo portal:** a confirmar na norma (portal próprio ou Central do Registro Civil;
  modelos; selo do TJRN). Fica para mudança própria.
