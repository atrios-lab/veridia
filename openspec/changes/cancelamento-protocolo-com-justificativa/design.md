## Context

`admin-service-requests` já resolve a mudança de andamento com uma única rota genérica,
`changeStatus` (`src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts:134-226`), chamada tanto
pelas pastilhas de sugestão quanto pelo select de correção manual em
`status-section.tsx`. Ela grava o andamento (`updateRequestStatus`,
`src/lib/service-request.ts:600-649`) e, hoje, só dispara e-mail de texto fixo ao cidadão para
"concluído" e "cancelado" — sem motivo nenhum e sem aviso para "indeferido".

O sistema já resolve o mesmo problema em dois lugares:
- **Exigência** (`src/core/request/requirement.ts`): texto livre obrigatório
  (`requirementTextSchema`, 1 a `MAX_MESSAGE_LENGTH` caracteres), visível na consulta pública em
  `protocol-lookup.tsx` (`RequirementRow`).
- **Cancelamento de agendamento** (`src/app/admin/(dashboard)/agenda/actions.ts:199-227`): motivo
  obrigatório, sem o qual a ação recusa ("Escreva o motivo: ele vai no e-mail que o cidadão
  recebe."), guardado em `appointments.cancel_reason` e enviado por e-mail.

Este change estende o mesmo padrão para o andamento do protocolo, só para os dois andamentos que
encerram o pedido sem entrega: Cancelado e Indeferido (que aqui cobre o que o pedido descreveu
como "devolvido" — não existe e não será criado um andamento separado para isso).

## Goals / Non-Goals

**Goals:**
- Exigir justificativa em texto livre antes de confirmar a mudança de andamento para Cancelado ou
  Indeferido, pelo mesmo `changeStatus` que já trata os outros dezesseis andamentos.
- Gravar a justificativa de forma consultável no histórico do pedido (painel) e na consulta
  pública (cidadão).
- Avisar o cidadão por e-mail com o motivo, incluindo Indeferido na lista de andamentos que
  avisam (hoje só Concluído e Cancelado avisam).

**Non-Goals:**
- Não introduz um novo andamento "Devolvido" nem mexe na máquina de dezoito andamentos existente.
- Não exige justificativa para nenhum outro andamento, nem para o cancelamento de agendamento
  (fluxo já independente, já resolvido).
- Não permite editar a justificativa depois de gravada; corrigir é mudar o andamento de novo.
- Não faz nada retroativo: pedidos já cancelados/indeferidos antes do deploy ficam sem
  justificativa, exibida como "não informado".

## Decisions

### Onde grava a justificativa: nova coluna em `service_requests`, não em `details` jsonb

`service_requests.details` (jsonb) hoje guarda o que é específico de um `kind` (dia/banda de
agendamento, direito escolhido no canal LGPD). A justificativa de andamento é genérica ao
`kind: "service-request"` e precisa ser consultável e auditável como uma coluna de primeira
classe — o mesmo raciocínio que já levou `appointments.cancel_reason` a ser coluna, não jsonb.
**Decisão:** nova coluna `service_requests.status_reason` (text, nullable), sobrescrita a cada
nova mudança de andamento que a exige. `audit_log` (`src/db/schema.ts:68-82`) não tem coluna de
texto livre e não ganha uma aqui: `listRequestHistory` (`src/lib/service-request.ts:1441-1465`)
passa a fazer um join com `service_requests` e a mostrar `status_reason` apenas na entrada mais
recente de `action: "service-request.status"`, e só quando o andamento atual do pedido é
Cancelado ou Indeferido. Não há histórico de motivos anteriores a um cancelamento reaberto e
cancelado de novo — ver trade-off abaixo.

Alternativa considerada e descartada: guardar em `details.statusReason`. Rejeitada porque
`details` é lido pelo núcleo por `kind` (comentário em `schema.ts:129-131`) e misturaria um campo
transversal com dados específicos de canal.

### Validação: reaproveitar `requirementTextSchema`, não duplicar

A exigência já tem exatamente a validação certa (trim, mínimo 1, teto `MAX_MESSAGE_LENGTH`, com a
mesma mensagem de erro em português). **Decisão:** exportar esse schema de
`src/core/request/requirement.ts` sob um nome genérico (ou reexportar) e usá-lo também para a
justificativa de andamento, em vez de escrever um segundo schema quase idêntico.

### UI: passo de confirmação com campo de texto, não modal separado

`status-section.tsx` hoje trata Cancelado/Indeferido como qualquer outra pastilha: um clique,
sem confirmação. **Decisão:** quando o `status` submetido (pela pastilha ou pelo
`statusOverride`) for `cancelled` ou `rejected`, a UI intercepta o clique antes do submit e abre um
passo inline com `<textarea name="reason">` obrigatório e um botão "Confirmar" — mesmo padrão já
usado em `close-day.tsx` para o cancelamento de agendamento, sem introduzir um componente de modal
novo no design system.

Alternativa considerada: exigir a justificativa só no servidor, deixando o clique da pastilha
passar direto e devolvendo erro se faltar motivo. Rejeitada: o operador clicaria a pastilha, veria
"escreva o motivo" sem campo nenhum na tela (porque a pastilha não tem textarea), e teria que
descobrir sozinho onde digitar — pior que pedir de saída.

### Motivo é obrigatório, não opcional

Segue a decisão já tomada em `cancelOneAppointment`: "a cancellation with no why is what makes
someone show up anyway" — aqui, um protocolo cancelado sem motivo é o que faz o cidadão ligar pra
serventia perguntar por quê. **Decisão:** o servidor recusa a mudança para Cancelado/Indeferido
sem `reason` não vazio (depois de `trim`), com a mesma mensagem de erro em português que os outros
dois formulários já usam como referência de tom.

### E-mail: Indeferido passa a avisar, motivo continua fora do corpo

Hoje `changeStatus` só avisa para `done`/`cancelled` (actions.ts:208-219), com o comentário
"a message per andamento would train them to ignore all of them" — decisão deliberada de não
avisar em todo andamento. A regra geral de avisos já existente (`admin-service-requests`, "Avisos
por e-mail nas ações que afetam o cidadão") é explícita: o aviso NÃO carrega conteúdo — nem o
texto da exigência, nem o arquivo, nem o valor; só o protocolo e a instrução de consultar com a
chave. **Decisão:** manter essa regra sem exceção. Indeferido passa a avisar (paridade com
Cancelado, mesma categoria "os dois que encerram sem entrega"), mas o corpo do e-mail continua sem
o motivo — igual ao que já acontece com a exigência, que avisa "há uma exigência" sem o texto. O
motivo completo só aparece na consulta pública, atrás da chave de acesso.

Alternativa considerada: colocar o motivo no corpo do e-mail, como já acontece no cancelamento de
agendamento (`cancelOneAppointment`). Rejeitada para protocolo: agendamento não tem consulta
protegida por chave — o e-mail é o único canal, então carregar o motivo ali é a única forma de
avisar. Protocolo já tem a consulta com chave como canal seguro para conteúdo; duplicar o motivo
no e-mail (que não é autenticado) romperia sem necessidade uma regra de segurança/privacidade já
deliberada para este canal.

## Risks / Trade-offs

- **[Risco] Correção manual (`statusOverride` + "Aplicar") também precisa do mesmo passo de
  confirmação, não só as pastilhas de sugestão** → o campo de motivo entra no mesmo bloco
  "Corrigir para outro andamento", condicionado ao valor selecionado no `<select>`, para não
  duplicar a lógica de confirmação em dois lugares da tela.
- **[Risco] Pedidos antigos sem justificativa aparecem com o mesmo selo Cancelado/Indeferido de
  sempre** → a consulta pública e o histórico do painel tratam `status_reason` nulo como "motivo
  não informado" em vez de esconder o bloco, para não sugerir ausência de dado como bug.
- **[Trade-off] Sobrescrever `status_reason` a cada nova mudança perde o motivo de um
  cancelamento anterior, se o pedido for reaberto e cancelado de novo** → aceitável porque a
  correção manual para tirar um pedido de Cancelado/Indeferido já é um caso raro de exceção
  (Non-Goals), e o motivo que importa para o cidadão e para o balcão é sempre o do andamento
  atual, não o de um cancelamento já revertido.

## Migration Plan

1. Migração aditiva: `ALTER TABLE service_requests ADD COLUMN status_reason text` (nullable, sem
   default) — sem necessidade de dois deploys porque não é destrutiva.
2. Deploy do núcleo, da action e da UI do painel juntos (mesmo deploy da coluna, já que a coluna é
   aditiva e não quebra o código antigo rodando contra ela).
3. Sem rollback especial: a coluna nullable não quebra nada se o deploy for revertido antes da UI
   usá-la; se revertido depois, o pior caso é `status_reason` gravado e não lido, sem perda de
   dado.

## Open Questions

(nenhuma — escopo de "devolvido" já resolvido como equivalente a "Indeferido" com o usuário antes
deste documento)
