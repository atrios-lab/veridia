## Context

Paridade de balcão com o painel legado (`/Users/ntpaulo/cartorio-marinho`), nas três lacunas que
travam a migração: imprimir a folha, corrigir dados protocolados, formulário preso à exigência.

Estado atual do Veridia relevante para as três:

- O requerimento em PDF é montado por `buildRequerimento` (núcleo puro) e desenhado por
  `renderDocument(document, brand)`; a única rota que o serve é pública e exige a chave
  (`POST /solicitar/requerimento`). A chave existe só como hash; `reissueKeyAction` devolve a
  nova chave uma única vez para a tela (`KeySection`).
- O painel já tem `/admin/documento` (GET por sessão) servindo qualquer anexo do pedido, inline
  para PDF/imagem — a "via assinada" já é servível por ela.
- Exigências: `service_request_requirements` tem `resolutionAttachmentId` (resposta do cidadão),
  nada no sentido serventia→cidadão. A rota pública `POST /protocolo/documento` serve qualquer
  anexo do pedido mediante protocolo + chave, então o download público do formulário não precisa
  de rota nova.
- Não existe nenhuma atualização de dados do pedido no painel; `src/lib/service-request.ts`
  concentra as escritas com auditoria (`recordAudit`).

## Goals / Non-Goals

**Goals:**
- Folha imprimível pela sessão do painel, idêntica à do cidadão; via assinada quando existir.
- Comprovante de acesso imprimível apenas no instante em que a chave reemitida está na tela.
- Correção de nome, contato, CPF, finalidade, descrição e data/hora, com trilha de auditoria.
- Formulário anexado à exigência, visível nos dois lados, fora da lista de entregas.

**Non-Goals:**
- Editar ato ou protocolo; "Próximo passo"; marcar exigência cumprida pelo balcão; tamanho de
  arquivo e separação de anexos por origem (fatias futuras).
- Guardar a chave em claro, em qualquer forma.

## Decisions

### 1. Impressão: uma rota GET por sessão, reusando o pipeline inteiro

Nova `GET /admin/pedidos/[protocolo]/imprimir`. Autentica sessão + `requests.manage` (mesma
dupla checagem das actions), monta `buildRequerimento` + `brandFor(tenant, origin/protocolo)` e
responde `inline`. GET porque não há chave a esconder de logs — é o mesmo raciocínio, invertido,
do comentário da rota pública.

Para o comprovante: a rota aceita `?comprovante=1` **apenas via POST** com a chave no corpo
(`chave`), e monta `buildAccessReceipt` com ela. A chave vem da tela (estado do `KeySection`
logo após a reemissão), nunca do banco — o servidor não tem como produzi-la. Sem chave no corpo,
não há comprovante: a restrição "só enquanto está na tela" é estrutural, não de UI.

*Alternativa descartada:* rota separada `/admin/requerimento?requestId=`. O detalhe já vive sob
`[protocolo]`, e a folha é deste pedido; a URL que se imprime e se cola em conversa fica legível.

*Alternativa descartada:* botão que injeta a chave reemitida como query string. Chave em URL é o
que este projeto passou três changes evitando.

### 2. "Imprimir via assinada" é um link, não uma rota

Se `attachments` contém um `requerimento-assinado`, o botão do topo vira "Imprimir via assinada"
e aponta para `/admin/documento?...` — que já serve inline. Zero código novo de servidor. Com
mais de um assinado, o mais recente.

### 3. Edição de dados: uma action, um update auditado, sem schema novo no núcleo

`updateRequestDataAction` valida com um Zod local à action (nome ≥ 2, contato ≥ 3, CPF opcional
com dígito verificador via helper existente do núcleo, data/hora obrigatória e não-futura) e
chama `updateRequestData` nova em `src/lib/service-request.ts`, que grava e registra
`service-request.edit` na auditoria. O rótulo entra em `HISTORY_LABELS` ("corrigiu os dados do
pedido").

O formulário substitui os `Field` estáticos do cartão "Dados do solicitante" quando "Editar
dados" é acionado — mesmo padrão abrir/salvar/cancelar do `visual-identity-form`. `createdAt`
usa `<input type="datetime-local">` interpretado no fuso da serventia (`OFFICE_TIME_ZONE`), não
no do navegador: o protocolo vale pelo momento do atendimento no balcão.

*Alternativa descartada:* reusar `serviceRequestSchema` do formulário público. Ele valida o que
o cidadão envia (aceites, honeypot, descrição condicionada ao ato); o balcão corrige campos
soltos de um pedido que já existe. Forçar o mesmo schema acopla duas conversas diferentes.

### 4. Formulário da exigência: coluna nova em attachments, não tabela nova

`service_request_attachments` ganha `requirement_id uuid` anulável referenciando a exigência
(`onDelete: cascade`). Expand puro, deploy único. O formulário é um anexo comum com
`kind: "formulario-exigencia"` e `requirementId` preenchido; as listas existentes
("Entrega ao cidadão", "Documentos da serventia", "Seus arquivos") passam a filtrar
`requirementId is null` — o que hoje é verdade para todas as linhas, então nada muda para dados
existentes.

No painel, o cartão da exigência ganha o upload (mesmo dropzone das outras seções) e a linha
`AttachmentRow` com `onDelete` (é arquivo da serventia). Na consulta do cidadão, o cartão da
exigência lista o formulário e baixa pela rota pública existente (`POST /protocolo/documento`),
que já serve qualquer anexo do pedido mediante chave — `RequirementView` passa a carregar os
formulários da exigência.

*Alternativa descartada:* `formAttachmentId` na tabela de exigências (espelho do
`resolutionAttachmentId`). Limita a um formulário por exigência — o legado permite vários
("Anexar outro formulário"), e "vários arquivos por dono" é exatamente o que a tabela de anexos
já modela.

### 5. Rótulo legível

`formulario-exigencia` entra no mapa `LABELS` do `attachment-row.tsx` ("Formulário da
exigência") e no equivalente público, mantendo a regra: slug no banco, português na tela, nome
real do arquivo nunca (privacidade, ver `src/core/request/attachment.ts`).

## Risks / Trade-offs

- **Editar data/hora reescreve história** → é o requisito (balcão lança depois), e a auditoria
  guarda quem mudou e quando. O protocolo em si nunca muda.
- **POST do comprovante com a chave no corpo** → mesma disciplina das rotas públicas; a chave já
  trafega assim hoje. O que não pode existir é GET com chave, e não existe.
- **Filtro `requirementId is null` esquecido em alguma lista futura** → o teste do modelo cobre
  as três listas atuais; novas listas herdam o helper de filtragem em `src/lib`.
- **Impressão sem chave amplia quem consegue gerar o PDF** → só sessões com `requests.manage`,
  que já leem tudo do pedido pelo detalhe; o PDF não contém a chave desde a change anterior.

## Migration Plan

Deploy único. Migração Drizzle expand (coluna anulável + FK). Rollback: reverter o commit; a
coluna órfã fica inerte até um contract futuro.

## Open Questions

- O botão de imprimir dispara `window.print()` do PDF aberto ou só abre a aba? Abrir a aba basta
  (o navegador imprime dali); decidir no polish se vale o atalho.
