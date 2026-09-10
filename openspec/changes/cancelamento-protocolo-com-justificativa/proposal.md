## Why

Hoje, quando o balcão muda o andamento de um pedido de serviço para "Cancelado" ou "Indeferido",
o cidadão recebe apenas um e-mail de texto fixo ("O seu pedido foi cancelado.") e a consulta de
protocolo mostra só o selo do andamento — sem nenhuma explicação do motivo. O cidadão fica sem
saber por que o protocolo parou, e o balcão não tem onde registrar esse motivo além de telefonar
ou explicar pessoalmente. O sistema já resolve esse mesmo problema para a exigência (texto livre
visível na consulta) e para o cancelamento de agendamento (motivo obrigatório, enviado por
e-mail); cancelamento e indeferimento de protocolo são a lacuna que falta.

## What Changes

- Ao mudar o andamento de um pedido para **Cancelado** ou **Indeferido**, o operador DEVE
  informar uma justificativa em texto livre antes de confirmar a mudança.
- A mudança para um desses dois andamentos passa a exigir confirmação explícita (motivo +
  confirmar), em vez do clique único de hoje na pastilha de sugestão ou no "Aplicar" da correção
  manual.
- A justificativa fica gravada no pedido e aparece no histórico do detalhe (quem mudou, quando e
  por quê).
- A consulta pública de protocolo passa a exibir a justificativa junto ao selo do andamento,
  quando o pedido estiver Cancelado ou Indeferido.
- O indeferimento entra na lista de andamentos que avisam por e-mail (hoje só concluído e
  cancelado avisam). Seguindo a regra já existente de que o aviso não carrega conteúdo (mesmo
  padrão da exigência: avisa que há motivo, sem o texto), o corpo do e-mail não muda — o motivo
  completo fica na consulta pública, protegida pela chave de acesso.
- Pedidos já cancelados/indeferidos antes desta mudança não têm justificativa retroativa: a
  consulta e o histórico mostram a ausência de motivo como "não informado", sem exigir
  preenchimento posterior.

### Não-objetivos

- Não cria um novo andamento "Devolvido": o pedido devolvido ao cidadão sem seguir corresponde ao
  andamento já existente "Indeferido".
- Não exige justificativa para nenhum outro andamento (correção, exigência, arquivamento etc.) —
  só Cancelado e Indeferido, que são os dois que encerram o pedido sem entrega.
- Não altera o cancelamento de agendamento (`agenda`), que já tem seu próprio motivo obrigatório e
  não é tocado por esta mudança.
- Não adiciona edição da justificativa depois de gravada: se o operador errou o andamento, a
  correção é mudar o andamento de novo (fluxo já existente), não editar o texto do motivo.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: a mudança de andamento para Cancelado ou Indeferido passa a exigir
  justificativa com confirmação explícita, gravada no histórico do pedido; o andamento
  Indeferido passa a avisar o cidadão por e-mail (paridade com Cancelado).
- `service-request`: a consulta pública de protocolo passa a exibir a justificativa quando o
  andamento for Cancelado ou Indeferido.

## Impact

- **Banco de dados**: nova coluna em `service_requests` (ex.: `status_reason`) para guardar a
  justificativa; migração aditiva, sem quebra (`src/db/schema.ts`).
- **Núcleo**: schema Zod para validar a justificativa (texto obrigatório, mesmo teto de tamanho
  já usado em exigência/chat), reaproveitando `MAX_MESSAGE_LENGTH`.
- **Painel admin**: `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts` (`changeStatus`) e
  `_components/status-section.tsx` — pastilhas de Cancelado/Indeferido e o "Aplicar" da correção
  manual passam a abrir um passo de confirmação com campo de motivo antes de submeter.
  `src/lib/service-request.ts` (`updateRequestStatus`) passa a aceitar e gravar o motivo.
- **E-mail ao cidadão**: indeferimento passa a disparar aviso (hoje não dispara), no mesmo formato
  sem conteúdo já usado para cancelamento e exigência.
- **Consulta pública**: `src/app/(public)/protocolo/protocol-lookup.tsx` passa a exibir a
  justificativa junto ao selo do andamento nesses dois casos.
- **Histórico do painel**: `listRequestHistory` (`src/lib/service-request.ts`) passa a juntar o
  motivo gravado no pedido à entrada mais recente de mudança de andamento, sem alterar
  `audit_log`.
