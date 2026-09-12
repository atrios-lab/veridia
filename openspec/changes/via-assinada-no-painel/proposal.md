## Why

O cidadão assina o requerimento pelo Gov.br e devolve o arquivo pela tela de sucesso ou pela
consulta do protocolo (`attachSignedForm`, anexo de tipo `signed-form`). O painel guarda esse
arquivo na lista "Documentos anexados pelo cidadão", mas o botão "Imprimir requerimento" do
detalhe continua gerando um PDF novo, sem assinatura, mesmo com a via assinada no pedido. A spec
de `admin-service-requests` já exige o contrário desde a impressão no balcão ("Via assinada
quando ela existe": a ação se apresenta como via assinada e abre esse arquivo), e o cenário
nunca foi implementado. A change `imprimir-pedido-no-balcao` registrou a lacuna e a deixou de
fora.

Com a declaração de hipossuficiência o problema ficou mais caro: é o papel que o FCRCPN pede, o
cidadão pode assiná-lo pelo Gov.br, e o "Baixar declaração" do painel entrega sempre a versão
regerada, sem a assinatura. A via assinada, quando existe, é a que vale; o botão aponta para a
outra.

Há ainda uma lacuna no envio: o site aceita um arquivo só, "requerimento assinado". Num pedido
com gratuidade a pessoa tem dois papéis para assinar, e o sistema não sabe se o arquivo enviado
é o requerimento, a declaração ou os dois juntos.

## What Changes

- **Envio separado por documento.** A tela de sucesso e a consulta do protocolo passam a pedir
  "requerimento assinado" e, só em pedido com gratuidade, também "declaração assinada", em dois
  campos, cada um opcional e enviável a qualquer momento. Cada arquivo entra como anexo
  `signed-form` com o `displayName` que o distingue (`requerimento-assinado` já existe;
  `declaracao-assinada` é novo). Um arquivo só com os dois documentos continua aceito no campo do
  requerimento: o cidadão não é obrigado a separar o que assinou junto.
- **O painel oferece a via assinada quando ela existe.** No detalhe do pedido, a ação
  "Imprimir requerimento" passa a "Requerimento assinado" quando há `requerimento-assinado`
  anexado, abrindo o arquivo; e "Baixar declaração" passa a "Declaração assinada" quando há
  `declaracao-assinada`. Gerar de novo continua possível, como ação secundária ("Gerar sem
  assinatura"), porque o balcão às vezes precisa de uma folha limpa para assinar à mão. Vale o
  anexo mais recente de cada tipo: um reenvio corrige o primeiro.
- **A consulta do cidadão diz o que falta.** A linha da timeline "Aguardando requerimento
  assinado" passa a distinguir os dois documentos em pedido com gratuidade, e o cidadão pode
  rebaixar cada um dos arquivos que enviou.
- **Auditoria.** Abrir a via assinada pelo painel registra `service-request.print.*` como a
  geração já registra, com o id do anexo, para o rastro dizer qual arquivo saiu.
- **BREAKING**: nenhuma. Anexos `signed-form` antigos, todos com `displayName`
  `requerimento-assinado`, continuam sendo a via assinada do requerimento. Sem migração.

## Capabilities

### Modified Capabilities
- `service-request`: "Requerimento em PDF e envio do assinado" ganha o segundo campo para a
  declaração em pedido com gratuidade e a distinção na consulta.
- `admin-service-requests`: "Imprimir o requerimento no balcão" ganha a via assinada da
  declaração ao lado da do requerimento, a ação secundária de gerar, a regra do anexo mais
  recente e a auditoria da abertura.

## Impact

- `src/app/(public)/solicitar/actions.ts`: `attachSignedForm` aceita `documento`
  (`requerimento` | `declaracao`) e grava o `displayName` correspondente; o campo `declaracao`
  só é aceito em pedido com gratuidade.
- `src/app/(public)/solicitar/request-form.tsx` e `protocolo/protocol-lookup.tsx`: segundo
  campo de envio quando `hasExemption`; timeline e rebaixar por documento.
- `src/app/(public)/protocolo/actions.ts`: `signedForm` vira dois (`signedRequerimento`,
  `signedDeclaracao`), o mais recente de cada.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx`: as ações do cabeçalho leem os dois
  anexos e trocam rótulo e destino; `attachment-link.ts` ganha o rótulo
  "Declaração assinada".
- `src/app/admin/(dashboard)/pedidos/[protocolo]/imprimir/route.ts`: sem mudança; a via
  assinada abre pela rota de documento que já serve anexos (`/admin/documento`), que passa a
  registrar auditoria quando o anexo é `signed-form`.
- `src/core/request/attachment.ts` (ou onde vive a lista de `kind` de upload): `declaracao-
  assinada` como nome permitido.
- E2e: `service-request.spec.ts` (envio dos dois arquivos num pedido com gratuidade) e
  `admin-service-requests.spec.ts` (a ação vira "Requerimento assinado" depois do envio, e
  "Gerar sem assinatura" continua gerando).
- Sem migração de banco: `service_request_attachments` já tem `kind` e `displayName`.

## Non-Goals

- Validar a assinatura Gov.br (ICP-Brasil) do arquivo enviado: o sistema guarda o que o
  cidadão mandou; conferir a assinatura é do oficial, no visualizador do PDF.
- Comparar a via assinada com o PDF gerado: uma via assinada antes do PR #107 corresponde ao
  layout antigo, e está tudo bem.
- O comprovante de acesso e o formulário em branco: não têm via assinada.
- Mudar o que o balcão faz com o papel assinado à mão: o operador digitaliza e anexa pela
  seção de anexos, como hoje, e a partir desta change esse arquivo também conta como via
  assinada se for anexado com o tipo certo (tarefa do painel: o formulário de anexar do balcão
  ganha a opção "é o requerimento/declaração assinado").
