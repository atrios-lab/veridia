## Context

`counterHours` (`{ startHour, endHour }`, horas inteiras) é a fonte numérica do horário do
balcão. Ele é lido por `isWithinChatHours`/`nextChatOpening` (chat, página de contato, indicador
do painel) e pelo JSON-LD. A frase `openingHours` é o que o cidadão lê, e as duas metades andam
juntas no painel (`OfficeContactSchema`), gravadas como JSON em `tenant_content.published`.

Cinco serventias têm intervalo de almoço que só existe na frase. Os comentários de
`canguaretama.ts` e `brejinho.ts` já registram o limite ("`counterHours` only holds start and
end"). Taipu e Tibau do Sul fecham às 12h e voltam às 14h e 13h; Macaíba volta às 13h30.

## Goals / Non-Goals

**Goals:** intervalo opcional sem migração; um único cálculo de status e um único texto para o
site; cartão da home útil no celular.

**Non-Goals:** os da proposta (sem horário por dia, sem datas fechadas locais, sem minutos na
abertura/fechamento, sem mexer na agenda, nada que apague dado).

## Decisions

**1. `lunchBreak?: { start: "HH:MM", end: "HH:MM" } | null` dentro de `counterHours`.**
Alternativas: (a) trocar tudo por uma lista de intervalos em minutos: mais geral, mas muda o
formato que linhas antigas do painel já gravaram, exigindo leitura dupla para sempre; (b)
`breakStartHour`/`breakEndHour` inteiros: não cabe o 13h30 de Macaíba. `HH:MM` é legível no
arquivo de config e no `<input type="time">` do painel. Refinamentos: fim depois do início e o
intervalo inteiro dentro de abertura–fechamento (estritamente, para sobrar manhã e tarde).

**2. Linha antiga do painel herda o intervalo da config.**
Uma linha gravada antes desta change tem `counterHours` sem a chave `lunchBreak`. Substituir o
objeto inteiro (o merge raso de hoje) apagaria, na leitura, o intervalo recém-declarado na
config. Regra: chave ausente → herda o intervalo da config se ele couber nas horas salvas;
`null` → sem intervalo, por decisão explícita. Toda gravação nova do painel escreve a chave
(objeto ou `null`), então a ambiguidade só existe para linhas antigas.

**3. Cálculo em minutos, em um lugar só.**
`counterIntervals(hours)` devolve um ou dois intervalos `[início, fim)` em minutos do dia;
`isWithinChatHours` e `nextChatOpening` passam a usá-lo. `nextChatOpening` devolve também
`minute`. `counterStatus(tenant, now)` devolve uma união: aberto (com o próximo fechamento e se é
intervalo ou fim do dia) ou fechado (com a próxima abertura e se está em intervalo).
`counterStatusLabel` é a única fonte do texto, para home, contato e o que vier.

**4. Formato de hora: "8h", "13h30".** `formatClock` segue o padrão que a frase já usa.

**5. JSON-LD: duas `OpeningHoursSpecification` quando há intervalo**, que é como o schema.org
descreve um dia partido.

**6. Cartão da home.** Fica em fluxo no celular (depois da dica do campo de protocolo, então a
busca continua na primeira dobra de 390px) e absoluto no desktop, como hoje. O cartão inteiro é um
link para `/contato`. Status na primeira linha com ponto colorido (`bg-current`, mesma linguagem
do selo da página de contato), frase do horário na segunda; fechado, uma terceira linha lembra o
que o site faz sozinho. Texto pequeno vai de 11px para 13px. A home já é renderizada por
requisição (tenant pelo host), então o status é o do momento do acesso.

## Risks / Trade-offs

- [Linha antiga do painel com horas novas onde o intervalo da config não cabe] → a herança
  testa o intervalo contra as horas salvas e, se não couber, segue sem intervalo (decisão 2).
- [Serventia muda o horário de almoço e esquece o painel] → os campos ficam ao lado de abertura
  e fechamento, no mesmo bloco da frase.
- [Status congelado em cache de CDN] → a página já é dinâmica por depender do host; nenhuma
  diretiva de cache nova é adicionada.

## Migration Plan

Deploy aditivo. Nenhuma migração de banco, nenhuma variável de ambiente. Rollback = reverter o
deploy: linhas gravadas com `lunchBreak` continuam válidas no schema antigo, porque `z.object`
descarta chave desconhecida.

## Open Questions

Nenhuma.
