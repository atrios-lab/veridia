## Context

Os manuais do ONR anexados pela serventia definem os formatos: o lote do PGV-CNM
(`envioLoteModelo.xsd`), o JSON do Indicador Real (Especificações Técnicas v1.5, com a tabela de
311 tipos de logradouro) e o XML do Banco Light (WS Ofício v4.43, Anexo 1). O CNM segue o CNN,
art. 330 (módulo 97, ISO 7064), conferido contra CNMs devolvidos pelo PGV.

## Goals / Non-Goals

**Goals:** acervo estruturado, situação atual calculada dos atos, pendências da migração com
"Como fazer", arquivos da ONR prontos para importar, sistema próprio em outra aba.

**Non-Goals (próximas fases):** protocolo e prenotação, leitura das fichas pelo assistente virtual,
mapa e SIG-RI, livros com termos e assinatura A3, imagens do Livro 2 (CSL2), envio pelo WS
Ofício (depende do IDParceiroWS da ONR).

## Decisions

- **Situação calculada, não digitada.** Proprietários e ônus saem dos atos em ordem: titularidade,
  transmissão (total ou parcial, pelos transmitentes), ônus e cancelamento. O índice nunca diverge
  da matrícula.
- **Ato "M" (situação na migração).** O que a ficha já tinha ao entrar no sistema não é um
  lançamento: número 0, nunca impresso como R ou AV. `prior_acts` guarda quantos lançamentos a
  ficha já tinha, e o próximo R/AV continua dali.
- **Número de ato nunca reaproveitado.** O próximo número considera também os atos apagados.
- **Número repetido é pendência, não erro.** A tabela não tem índice único por número: durante a
  migração o mesmo número pode aparecer duas vezes (art. 338), e isso é o que a tela mostra.
- **Nada sai sozinho para a ONR.** O sistema gera, guarda (conteúdo e SHA-256) e a serventia importa
  com o certificado do oficial. "Já importei" no lote de CNM marca as matrículas como cadastradas
  no PGV.
- **Livro 3 fora do lote de CNM** até a ONR confirmar o TIPO do registro auxiliar.
- **Sistema próprio em aba nomeada** (`registro-de-imoveis`), com layout fora do painel, mas com a
  mesma sessão, o mesmo horário de acesso e as mesmas cores.

## Risks / Trade-offs

- A planilha pode trazer colunas com outros nomes: a conferência mostra cada coluna e o campo que
  ela preenche (ou "ignorada") antes de importar.
- Divergências da própria especificação do ONR (nomes de campos) seguem o exemplo oficial; o
  primeiro envio deve ser um lote pequeno.
