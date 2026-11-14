## Why

O Código Nacional de Normas (Provimento CNJ nº 149/2023) manda os tabeliães remeterem à CENSEC,
quinzenalmente, os atos de cada módulo (texto lido no compilado oficial do CNJ em 14/11/2026):

- art. 265: os módulos RCTO, CESDI, CEP e CNSIP;
- art. 267: RCTO, os testamentos, as revogações e os instrumentos de aprovação de cerrados, só com o
  testador (nome, documento, CPF, espécie, data, livro e folhas);
- art. 270: CESDI, as escrituras da Lei nº 11.441/2007 (separação, divórcio, inventário, partilha),
  com as partes, os documentos e o advogado;
- art. 272: CEP, as escrituras e procurações, exceto as do CESDI e do RCTO, com as partes, os
  documentos, o valor do negócio, o livro e as folhas;
- prazo: até o dia 20 (1ª quinzena) e até o dia 5 do mês seguinte (2ª quinzena), ou o próximo dia
  útil; sem ato, informação negativa; o comprovante de remessa arquivado.

O dono do projeto pediu (14/11/2026) que o painel gere essas cargas a partir da leitura das
escrituras, procurações e atos anexados, sem guardar os documentos ("ele será apenas para extração
de informação e gerar arquivo"), com vários arquivos ou um PDF único, o limite de tamanho e como
reduzir, o relatório de quantos eram e quantos foram, e editar, alterar e excluir.

Os campos, as tabelas e os formatos são os do CNB/CF, consultados em 14/11/2026: o Swagger da CENSEC
(CENSEC API 2.74.0: `Cargas.UploadCargaRequest`, `Atos.AtoCepData`, `Atos.AtoCesdiData`,
`Atos.TestamentoData`), as "Especificações dos campos de carga" do CEP, do CESDI e do RCTO, e os
artigos "JSON CENSEC (recomendado!)", "XML CENSEC" e "TXT CENSEC" da central de ajuda do CNB/CF, com
os arquivos de exemplo publicados.

## What Changes

- **Utilitários › Cargas da CENSEC** (permissão própria `censec.manage`, derivada da titularidade).
  - **Anexar documentos:** vários arquivos de uma vez ou um PDF único; o sistema separa os atos,
    lê e lança cada um na central e na quinzena certas e mostra o relatório (arquivos enviados,
    lidos, atos encontrados e lançados, pendências). Os arquivos não são guardados. Orienta como
    juntar os PDFs, o limite (50 MB por arquivo, 100 MB por envio) e como reduzir.
  - **Leitura:** central e tipo pelo título; natureza da escritura; livro e folha com complemento;
    data; MNE; valor; partes com qualidade, CPF ou CNPJ, RG e órgão; bem com matrícula, forma e
    prazo de pagamento; no CESDI, o casal (casamento, regime, filhos, nascimento, sexo, UF), o
    falecido, herdeiros, inventariante e advogado com OAB; no RCTO, o testador com a filiação; o ato
    de origem da revogação, renúncia, substabelecimento e rerratificação.
  - **Quinzena:** atos por central, prazo e aviso, pendências que a CENSEC recusa, editar (todos os
    campos), excluir com justificativa, lançar à mão, fechamento positivo ou negativo com a data e
    o protocolo, relatório em PDF.
  - **Arquivos:** JSON das três centrais (o recomendado) ou de cada uma, conferido com o esquema
    oficial; XML de cada central como os exemplos do CNB/CF; TXT do CESDI e do RCTO (o CNB/CF não
    publica as colunas do TXT do CEP). Só entram os atos sem pendência.
  - **Aproveitamento:** escrituras, inventários e partilhas com imóvel podem entrar também na
    comunicação à prefeitura (Carga CTP) e na DOI.
- **Banco:** tabelas `censec_acts` e `censec_closings` (migração que só cria tabelas).

## Impact

- Código: `src/core/censec/*`, `src/lib/censec*.ts`, `src/app/admin/(dashboard)/utilitarios/censec/*`,
  permissões, auditoria, menu e ajuda.
- Nada é apagado do banco: exclusão por marca, com quem, quando e por quê.
