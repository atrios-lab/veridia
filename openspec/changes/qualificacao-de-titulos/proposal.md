## Why

Todo título apresentado à serventia para registro, averbação, retificação ou cancelamento, no balcão
presencial ou no online, passa pela qualificação registral. Hoje a nota devolutiva é escrita à mão no
Word: é demorado, cada nota sai num formato diferente, as exigências se repetem sem padrão e a
conferência do que foi cumprido na reapresentação é toda manual. O dono do projeto pediu
(15/11/2026) que a qualificação fique em Utilitários, com a IA integrada lendo os títulos anexados e
propondo a qualificação positiva ou a nota de exigência, sempre revisada e aprovada por pessoa da
serventia. Mandou dois modelos de nota devolutiva: uma primeira qualificação (escrituras de doação
com usufruto, imóveis rurais) e um reexame após reapresentação (ata e estatuto de associação).

A base legal é a Lei nº 6.015/1973: prazo para registrar ou devolver com nota (art. 188), exigência
por escrito, de uma só vez, articulada, clara, com data, identificação e assinatura do oficial ou
preposto, e direito à suscitação de dúvida (arts. 198 a 204), e efeitos e prazo da prenotação
(art. 205). Somam-se a Lei nº 8.935/1994 (independência do oficial na qualificação, art. 28), o
Código Civil e o Código Nacional de Normas (Provimento CNJ nº 149/2023). O texto vigente de cada
artigo é conferido no compilado oficial antes da implementação, porque a Lei nº 14.382/2022 alterou
prazos.

## What Changes

- **Utilitários › Qualificação de títulos**, com permissão própria em Perfis e permissões.
- **Todas as atribuições da serventia (cartório de atribuições cumuladas)**, nesta ordem de
  implantação: Registro Civil das Pessoas Naturais, Registro de Imóveis, Notas, Títulos e Documentos,
  Pessoas Jurídicas e Protesto de Títulos (decisão de 15/11/2026).
- **Abertura da qualificação:** a partir de um pedido do balcão online (o protocolo REQ já existente)
  ou do balcão presencial; título e documentos anexados; atribuição e ato pedido (registro,
  averbação, retificação, cancelamento, abertura de matrícula, protesto, entre outros, conforme a
  atribuição).
- **Base jurídica da IA:** fontes classificadas pela hierarquia (lei, decreto, normas do CNJ e da
  Corregedoria, jurisprudência, enunciados, doutrina, modelos da serventia e de outros cartórios),
  enviadas em qualquer formato, inclusive ZIP, ou importadas do endereço oficial. Todo documento vira
  Markdown organizado (artigos como títulos, parágrafos e incisos em lista) e o arquivo é descartado;
  fica só o texto, dividido por artigo, que pode ser pesquisado e baixado em .md.
- **Biblioteca de exigências:** exigências padronizadas com título, descrição, o que apresentar para
  cumprir e fundamento legal; criada a partir dos modelos da serventia (reescritos de forma genérica,
  sem dados de clientes) e ampliada com as aprovadas no uso. Tudo editável, exclusão com
  justificativa.
- **Blocos de fundamentos gerais** por tipo de ato (doação, compra e venda, pessoa jurídica...),
  editáveis.
- **Nota devolutiva (de exigência):** numeração anual (nº/ano), cabeçalho oficial, apresentante,
  documento, protocolo; objeto, natureza da devolução, fundamentos, exigências numeradas e agrupadas
  por imóvel ou documento, forma de cumprimento, conclusão com o direito à dúvida, referências,
  prazo e observações. PDF e Word, assinatura digital ou física, envio ao apresentante pelo pedido.
- **Reexame após reapresentação:** a nota anterior é carregada; cada exigência é marcada cumprida,
  cumprida em parte ou pendente; o sistema monta "o que foi atendido", "exigências que permanecem",
  "exigências novas" (com aviso quando não decorrem de documento novo, por causa do art. 198) e a
  lista de providências.
- **Qualificação positiva:** termo de "título apto a registro/averbação", no mesmo padrão, anexado
  ao pedido.
- **Prazos:** prenotação e prazo para registrar ou devolver, por atribuição, com aviso de vencimento.
- **IA (fase 2):** lê os títulos (inclusive digitalizados), confronta com a matrícula e os documentos
  e propõe a qualificação positiva ou a lista de exigências, escolhendo primeiro da biblioteca e
  sempre com fundamento. Nada sai sem aprovação humana; quem aprovou fica na auditoria. A IA é ligada
  ou desligada pelo Tabelião em Configurações.
- **Nada é apagado do banco:** tabelas novas; exclusões por marca, com justificativa.

## Capabilities

### New Capabilities

- `qualificacao-titulos`: abertura da qualificação em todas as atribuições, biblioteca de exigências
  e de fundamentos, nota devolutiva, reexame, qualificação positiva, numeração, prazos, assinatura e
  envio, base jurídica da IA em Markdown e o rascunho proposto pela IA com aprovação humana.

### Modified Capabilities

- `admin-service-requests`: o pedido do balcão online passa a poder ser enviado à qualificação e a
  mostrar a nota devolutiva ou a qualificação positiva emitida para ele.

## Impact

- Código: `src/core/qualificacao/*` (puro: exigências, nota, reexame, prazos), `src/lib/qualificacao*`
  (banco, IA, arquivos), `src/app/admin/(dashboard)/utilitarios/qualificacao/*`, permissões,
  auditoria, menu, ajuda e numeração.
- Banco: tabelas novas para as qualificações, as notas, as exigências e a biblioteca (migração que só
  cria tabelas).
- Dependência nova na fase 2: SDK da Anthropic (Claude) chamado só no servidor; chave de API guardada
  como segredo do ambiente, nunca no código; contrato sem retenção dos dados enviados.
- LGPD: os títulos têm dados pessoais; só o necessário de cada qualificação vai à IA; os arquivos
  anexados podem não ser guardados após a leitura, como nas cargas da CENSEC.

## Non-goals

- A IA não decide nem emite nada sozinha: a qualificação é do oficial (Lei nº 8.935/1994, art. 28).
- Não faz o registro em si (lançamento na matrícula ou nos livros), nem o protocolo oficial (Livro 1)
  nem a suscitação de dúvida ao juízo: apenas informa o direito a ela.
- Não cobra emolumentos nem calcula custas.
- Não integra, nesta mudança, com a ONR, o SAEC ou o e-Notariado; os títulos entram por anexo ou pelo
  pedido do balcão online.
- Não usa os dados dos modelos enviados (nomes, números, imóveis): só a estrutura e o raciocínio
  jurídico, reescritos.
