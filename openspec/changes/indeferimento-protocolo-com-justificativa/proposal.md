## Why

Hoje, ao indeferir um pedido de serviço, o balcão só pode registrar o motivo como texto livre
(implementado em #92): a mudança de andamento para "Indeferido" exige uma justificativa digitada,
sem opção de anexar o documento que já embasa a decisão (ex.: parecer do oficial, certidão negativa,
ofício). Quando o motivo do indeferimento está descrito num documento formal, o operador precisa
transcrever ou resumir esse conteúdo à mão na caixa de texto, ou avisar o cidadão por fora. O
sistema já resolve o aviso por e-mail sem conteúdo e a consulta protegida por chave para esse
andamento (#92) — falta apenas o canal de anexar o documento como alternativa (ou complemento) ao
texto.

## What Changes

- Ao indeferir um pedido (mudar o andamento para **Indeferido**), o operador passa a poder, no
  mesmo passo de confirmação que já exige motivo, **anexar um PDF** em vez de (ou além de) escrever
  a justificativa em texto — pelo menos um dos dois (texto ou PDF) continua obrigatório.
- O PDF anexado ao indeferimento é gravado como um anexo do pedido, seguindo o mesmo mecanismo já
  usado para o documento final e o formulário de exigência (`storeAttachments`), sem upload direto
  ao Blob.
- A consulta pública de protocolo, que já exibe o motivo em texto para um pedido indeferido, passa
  a exibir também um botão de download do PDF anexado, quando houver, usando o mesmo padrão
  autenticado por chave de acesso (POST) já usado para os demais anexos do pedido.
- O histórico do painel (detalhe do pedido) passa a mostrar, na entrada de mudança de andamento
  para Indeferido, o link para o PDF anexado, além do texto do motivo quando também informado.
- O e-mail de aviso ao cidadão **não muda**: já avisa que o pedido foi indeferido sem carregar
  conteúdo (#92), instruindo a consultar o protocolo com a chave de acesso — regra que se mantém
  também para o PDF, que nunca vai por e-mail.

### Não-objetivos

- Não estende essa opção de anexo ao andamento **Cancelado**: a mudança feita em #92 (motivo em
  texto obrigatório) continua igual para Cancelado; só Indeferido ganha a opção de PDF.
- Não permite mais de um PDF por indeferimento, nem editar/substituir o anexo depois de gravado: a
  correção, como já vale para o texto, é mudar o andamento de novo.
- Não adiciona verificação de conteúdo do PDF além do que já existe para outros anexos (allowlist
  de MIME + limite de tamanho); não introduz antivírus/scanner.
- Não muda o corpo do e-mail de aviso nem cria um canal alternativo de notificação: o cidadão
  continua precisando acessar a consulta pública com a chave de acesso para ver o motivo, seja
  texto ou PDF.
- Não retroage: indeferimentos já registrados antes desta mudança continuam sem PDF, exibidos como
  hoje (motivo em texto ou "Motivo não informado").

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: a confirmação de indeferimento passa a aceitar um PDF anexado como
  alternativa (ou complemento) ao texto do motivo — pelo menos um dos dois é obrigatório; o
  histórico do pedido passa a exibir o link do PDF quando houver.
- `service-request`: a consulta pública de protocolo passa a exibir um botão de download do PDF do
  indeferimento, além do texto do motivo, quando o pedido estiver Indeferido e tiver anexo.

## Impact

- **Banco de dados**: sem migração — reaproveita `service_request_attachments` (já existente) com
  um novo valor de `kind` (ex.: `"rejection-document"`), amarrado ao `requestId`, igual ao padrão
  já usado pelo comprovante de pagamento (`kind: "payment-receipt"`, sem nova coluna).
- **Núcleo**: `requiresStatusReason`/`statusReasonSchema`
  (`src/core/request/kinds.ts`) passam a admitir motivo vazio quando um PDF acompanha a mudança
  para `rejected` — a validação "pelo menos um dos dois" fica no núcleo, não espalhada na action.
- **Painel admin**: `changeStatus`
  (`src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`) passa a ler um arquivo opcional do
  `FormData` quando o status alvo for `rejected`, validar com as mesmas regras de anexo já usadas
  em `deliverDocumentAction`/`attachRequirementFormAction`, e gravá-lo via `storeAttachments`.
  `_components/status-section.tsx` (`ReasonConfirmation`) ganha um campo de arquivo PDF, seguindo o
  padrão de input oculto com auto-submit de `attachments-section.tsx`.
- **Consulta pública**: `src/app/(public)/protocolo/protocol-lookup.tsx` passa a exibir, junto ao
  motivo em texto do indeferimento, um botão "Baixar documento" reaproveitando o formulário POST +
  `ProtocolFields` já usado pelos demais anexos da tela.
- **Histórico do painel**: a entrada mais recente de `service-request.status` para um pedido
  Indeferido passa a incluir, quando houver, o link do PDF anexado (rota admin de documento já
  existente, `src/app/admin/(dashboard)/documento/route.ts`).
- **E-mail**: nenhuma mudança — o aviso de indeferimento já existe e já não carrega conteúdo (#92).
