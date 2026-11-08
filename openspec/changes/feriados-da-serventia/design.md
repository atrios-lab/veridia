## Context

`isBusinessDay` é a regra única de dia útil, usada por status, chat, agenda, prazos e editais, e
até aqui era pura sobre a data: feriados nacionais e os do Código de Normas do estado. Feriado
municipal depende da serventia, então a função precisa saber de qual serventia se trata.

## Goals / Non-Goals

**Goals:** a serventia declara os próprios dias sem expediente no painel, e todo cálculo de dia
útil os respeita. **Non-Goals:** os da proposta.

## Decisions

**1. Parâmetro explícito, não contexto global.** `isBusinessDay(date, holidays = [])` e as
funções acima dela recebem `OfficeHolidays`. Alternativa: um contexto por requisição
(AsyncLocalStorage). Rejeitada: o núcleo é puro e sem I/O, e um estado implícito por requisição
num servidor multi-serventia é como um feriado de uma cidade fecha a agenda de outra. O padrão
`= []` mantém os testes e helpers simples; o risco de esquecer é coberto pela revisão de todos os
pontos de chamada (listados na tarefa 3) e por quem conhece a serventia sempre passar
`tenant.customHolidays`.

**2. Agenda: `OfficeAgenda = AgendaConfig & { holidays? }`.** As regras de horário recebem a
configuração da agenda em quase toda função (`freeSlots`, `isSlotFree`, `offeredDays`…). Somar os
feriados à configuração no ponto de leitura evita um parâmetro a mais em cada uma, sem gravar
nada na linha da agenda (o campo não está no schema salvo).

**3. Dois tipos de feriado: anual e data única.** `yearly: true` compara dia e mês; `false`
compara a data exata. Cobre padroeiro e aniversário (anuais) e ponto facultativo (único).

**4. Lista salva inteira, em um campo JSON do formulário.** Linhas entram e saem no cliente; um
número variável de linhas em nomes de campo planos é um parser a errar. O schema (`OfficeHolidaysSchema`)
é a fronteira: nome de 1 a 80 caracteres, data real, até 60 itens. Erros voltam por linha e campo.

**5. O painel mostra o que já conta.** `upcomingClosedDays(today, 365)` lista os dias da lei nos
próximos 12 meses, recolhidos num `<details>`, para a serventia não duplicar o que já existe.

## Risks / Trade-offs

- [Chamada nova esquece de passar os feriados] → padrão `[]` deixa a conta só sem os feriados
  municipais (o comportamento anterior), nunca quebra; o comentário de `isBusinessDay` avisa.
- [Feriado cadastrado muda prazos em andamento] → esperado: prazos são calculados na leitura, e a
  serventia fechada não pode contar o dia.

## Migration Plan

Aditivo. Nenhuma migração: nova chave em `tenant_content`. Rollback = reverter o deploy; a linha
salva fica sem leitor e não atrapalha.

## Open Questions

Nenhuma.
