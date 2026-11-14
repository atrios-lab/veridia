## Context

A CENSEC recebe as cargas por API ou por upload, em JSON (recomendado), XML ou TXT. O esquema oficial
está no Swagger da CENSEC; a parte usada pela carga foi copiada sem alteração para
`src/core/censec/censec-carga.schema.json` e serve para conferir o arquivo no painel e nos testes.

## Decisions

- **Documento não guardado.** O arquivo anexado é lido em memória, página a página; fica só o ato
  lido (`censec_acts.data`) e o nome do arquivo de origem.
- **Um PDF com vários atos.** A separação é pela abertura do ato no topo da página (ESCRITURA,
  PROCURAÇÃO, TESTAMENTO, INVENTÁRIO...) e pelo livro e folha diferentes; uma página que não abre
  ato continua o anterior.
- **Pendência não bloqueia o lançamento.** O ato lido entra mesmo incompleto, com a pendência
  mostrada; o arquivo só leva os atos sem pendência, para a CENSEC não recusar a carga inteira.
- **Tabelas como no CNB/CF.** Cada opção guarda o nome do JSON, o número do XML e TXT e o rótulo da
  tela; as cinco cessões novas da v4.2 do CEP ainda não têm número e vão só no JSON.
- **CPF primário no CESDI.** No JSON o CPF é o documento primário e a OAB o secundário; no XML e no
  TXT a OAB vai primeiro, como no exemplo oficial.
- **Fechamento.** O fechamento é feito no CENSEC; o painel registra a data e o protocolo, e o
  relatório da quinzena mostra quantos atos eram e quantos foram.

## Risks

- A leitura depende do texto do traslado: PDF digitalizado como imagem não é lido, e o ato é lançado
  à mão. Toda leitura é conferida na tela antes de gerar o arquivo.
