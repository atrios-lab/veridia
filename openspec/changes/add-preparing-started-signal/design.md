## Context

A consulta de protocolo (`src/app/(public)/protocolo/protocol-lookup.tsx`) monta o bloco "Andamento" a partir de `timelineSteps()`, uma função pura que devolve `{ label, done?, detail?, alert? }[]`. O `TimelineStep` que renderiza cada item só distingue dois estilos: `done` (ponto preenchido cor de destaque, texto escuro) e o padrão apagado (ponto vazado, texto cinza-claro) usado tanto para "ainda não chegou aqui" quanto para "é exatamente onde o pedido está agora". Um pedido "Pago" empurra a etapa "Em preparo na serventia" com `done: false` — que renderiza idêntica à etapa seguinte, "Conclusão e entrega", também `done: false`. O cidadão não tem pista visual de qual das duas é o presente e qual é o futuro.

O painel admin já resolveu o mesmo problema em `src/app/admin/(dashboard)/pedidos/[protocolo]/_components/status-section.tsx`: seu `TimelineStep` tem três estados (`done` / `current` / `upcoming`), com `current` desenhado como anel de destaque (`border-2 border-admin-primary bg-admin-primary`) com um ponto branco dentro — visualmente distinto tanto do check verde quanto do anel cinza neutro.

## Goals / Non-Goals

**Goals:**
- A etapa em que o pedido está agora é visualmente distinta de uma etapa futura, na consulta pública.
- Reaproveitar o padrão visual dos três estados já existente no admin, sem inventar um quarto estilo.
- Zero mudança de dado: a etapa atual é derivada da mesma lista que `timelineSteps()` já produz.

**Non-Goals:**
- Data/timestamp de quando o pedido entrou em preparo (mantém a decisão do `improve-protocol-timeline`: etapas sem registro real não ganham data inventada).
- Novo botão ou campo no admin.
- Mudar o `TimelineStep` do admin (já tem o padrão certo).

## Decisions

**1. `current` é a primeira etapa da lista com `done` falso, calculada em `timelineSteps()`, não no JSX.**
A lista já é sequencial e cada etapa representa um marco do ciclo (recebido → requerimento → exigência → pagamento → preparo → entrega). A primeira que ainda não está `done` é, por construção, onde o pedido está parado agora — a mesma lógica que o `happyIndex` do admin usa (`HAPPY_PATH.indexOf(status)` decide `current` por posição). Aqui a posição já existe na própria lista, então basta marcar o primeiro item `!done` depois de montá-la. Alternativa rejeitada: calcular "current" a partir do `requestStatus` bruto, duplicando a lógica que já decide quais etapas entram na lista — mais lugares para os dois ficarem incoerentes.

**2. Etapas de alerta (`Pedido indeferido`/`Pedido cancelado`) nunca viram `current`.**
Já têm estilo próprio (`brand-alert`) que comunica "isto travou aqui" com mais força que um destaque de "andamento normal". `current` só se aplica a `!done && !alert`.

**3. `TimelineStep` ganha uma prop `current?: boolean`, com o mesmo desenho de anel-com-ponto do admin, adaptado às classes `brand-*` do público (`border-brand-accent` em vez de `border-admin-primary`).**
Sem componente novo, sem variante de cor nova fora do tema — só uma combinação a mais das classes que `TimelineStep` já usa condicionalmente.

**4. Quando não há etapa `!done` (tudo concluído, ou lista termina em alerta), nenhuma etapa vira `current`.**
Não força destaque onde não há "presente" a apontar — um pedido `done` com todas as etapas concluídas não tem etapa atual, só etapas passadas.

## Risks / Trade-offs

- [Duas etapas "quase current" ao mesmo tempo — ex. exigência pendente E pagamento pendente] → só a primeira da lista (exigência, que vem antes na ordem) recebe o destaque; a de pagamento permanece no estilo apagado padrão. Isso é consistente com a ordem que a própria timeline já define como sequencial.
- [Destaque visual sozinho ainda não diz *quando* a serventia começou a preparar] → aceito conscientemente (non-goal); se virar requisito, é mudança própria que envolve o `auditLog` (que hoje tem um bug de `targetId` nas entradas `service-request.status`, gravando o valor do status em vez do id do pedido — fora do escopo aqui).
