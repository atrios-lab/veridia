## Context

As duas telas existem e funcionam; a mudança é de forma e de quatro comportamentos novos
(balcão, falta, protocolo, `notaryOnly`). O núcleo (`src/core/scheduling`) já tem tudo de
calendário/slots que a régua e a prévia precisam; o protocolo já tem prefixo `AGD` reservado em
`core/request/protocol.ts` (era usado só por linhas legadas dormentes em `service_requests`).

## Goals / Non-Goals

**Goals:** as telas dos mockups, com regra nova no núcleo e validação no servidor; migração
apenas expansiva; nenhum dado existente perdido (modos custom, configs antigas sem
`notaryOnly`, agendamentos sem protocolo).

**Non-Goals:** shadcn ou qualquer dependência nova; mudanças no fluxo público de marcar;
cancelamento de agendamentos por edição de grade; duração por serviço.

## Decisions

- **Status e origem no núcleo**: `no_show` entra em `APPOINTMENT_STATUSES` e em
  `SLOT_HOLDING_STATUSES` (a hora foi gasta; e o índice parcial já bloqueia rebooking de tudo
  que não é cancelado). Origem é coluna `origin` (`site` | `desk`) com default `site` — badge é
  apresentação, origem é fato do registro.
- **Protocolo na própria tabela `appointments`** (`protocol_year/sequence/number`, anuláveis
  para o legado), alocado no `bookAppointment` com o mesmo laço ler-máximo → inserir → retry de
  `service-request.ts`. A violação única é desambiguada pelo nome da constraint: índice do slot
  → `SlotTakenError`; índice do protocolo → tenta a próxima sequência. Consulta pública: se
  `findByProtocol` não achar e o prefixo for AGD, busca em `appointments`.
- **"Avisa o cidadão" do mockup ao remover horário da grade**: a spec vigente garante que
  edição de grade nunca cancela agendamento; manter. A confirmação avisa o **operador** de que
  os agendamentos existentes continuam valendo. Divergência deliberada do texto do mockup.
- **Modos**: schema continua `string[]`. O painel renderiza cartões para a união de modos
  conhecidos (Presencial, On-line, Diligência, Drive-thru — descrições são microcopy do
  painel, não conteúdo do tenant) e modos já configurados fora dessa lista. Sem campo de texto
  livre para modo novo: os quatro conhecidos cobrem a prática, e um modo exótico já salvo não
  se perde. Simplificação deliberada.
- **Régua**: dois parâmetros de query — `dia` (seleção) e `de` (âncora da página da régua,
  default hoje). Setas mudam `de` em ±7 dias corridos mantendo `dia`; cada página mostra os
  próximos 7 dias úteis a partir de `de`. Passado permitido: marcar falta acontece depois do
  fato.
- **Contato na linha**: telefone visível; e-mail no `title` da linha (uma linha só, como no
  mockup).
- **Ids de serviço**: continuam derivados do rótulo no servidor (`withUniqueIds`), agora
  carregando `notaryOnly`; configs antigas parseiam com default `false`.
- **Prévia**: client-side sobre o estado do formulário; a página passa `takenTimesByDay` de
  hoje a +27 dias para riscar ocupados. Dias da prévia: próximos 3 dias úteis com horário no
  estado atual, pulando datas fechadas.
- **Barra de salvar**: o formulário serializa o config inteiro como JSON num campo único;
  `saveAgenda` parseia com `agendaConfigSchema` (grade meio salva continua impossível). Toast
  de sucesso via sonner, já presente no layout do painel.
- **`AdminPageHeader`**: ganha prop opcional `back` (href + rótulo). É a mudança mínima no
  componente compartilhado que o breadcrumb do mockup exige.

## Risks / Trade-offs

- [Ambiguidade de constraint no insert] → helper que lê `constraint_name` na cadeia de causas;
  constraint desconhecida → erro propaga, sem retry cego.
- [Config JSON no form quebra com JS de navegador antigo] → painel já é todo client-interativo
  (useActionState em tudo); sem regressão real.
- [Contagem de sequência por `max+1` sob corrida] → o mesmo trade-off já aceito nos outros
  canais; índice único decide, cinco tentativas.
- [e2e existentes dependem de rótulos] → nomes acessíveis preservados: "Marcar atendido"
  (era "Atendido"), formulário de fechar dia mantém "Motivo" e "Fechar o dia e avisar".

## Migration Plan

Uma migração expand: duas colunas anuláveis + `origin` com default + índices únicos parciais.
Sem backfill: protocolo nulo é legítimo (legado) e a UI o omite. Nada a contrair depois.
