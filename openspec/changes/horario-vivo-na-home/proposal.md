## Why

O cartão de horário da home é a primeira coisa que responde "posso ir agora?", e hoje ele não
responde: repete a frase do horário, some no celular (`hidden md:inline-flex`) e tem o subtítulo
em 11px. Pior: o "Aberto agora" que a página de contato e o chat já calculam erra nas serventias
com intervalo de almoço (Canguaretama, Brejinho, Taipu, Tibau do Sul, Macaíba 1º), porque
`counterHours` só guarda abertura e fechamento. Às 13h essas serventias aparecem como abertas, e o
chat aceita conversa sem ninguém no balcão.

## What Changes

- `counterHours` ganha um intervalo opcional (`lunchBreak`, início e fim em `HH:MM`, aceitando
  meia hora, como o 13h30 de Macaíba). Campo novo e opcional dentro do JSON que já existe: sem
  migração, nada apagado, linha antiga do painel continua válida.
- O cálculo de "aberto agora" passa a respeitar o intervalo, em minutos: chat, página de contato,
  indicador do painel e o JSON-LD (que passa a declarar manhã e tarde separadas).
- Um único texto de status para o site inteiro: "Aberto agora · fecha às 14h", "Aberto agora ·
  intervalo às 12h", "Em intervalo · volta às 14h", "Fechado agora · abre segunda às 8h".
- Cartão da home: aparece também no celular (abaixo da busca de protocolo, sem tirá-la da
  primeira dobra), mostra o status ao vivo com a frase do horário embaixo, fora do horário lembra
  que pedidos e agendamentos pelo site funcionam a qualquer hora, leva à página de contato ao
  toque e sobe o texto pequeno para 13px.
- O cartão pisca de leve para não passar despercebido: o mesmo halo do item Treinamento do
  painel, mais discreto e na cor do próprio texto do cartão. Quem desligou animações no aparelho vê o cartão parado.
- Dias sem expediente seguem o Código de Normas do RN (Provimento 156/2016, §6º): além dos
  feriados nacionais, segunda e terça de Carnaval, quarta de Cinzas, São João (24/06), São Pedro
  (29/06), véspera de Natal (24/12), véspera de Ano Novo (31/12) e o feriado estadual de 03/10
  (Mártires de Cunhaú e Uruaçu, Lei estadual 8.913/2006). Vale para tudo que conta dia útil:
  status, chat, agenda, prazos dos pedidos e editais.
- Num feriado em dia de semana, o status diz que é feriado e qual: "Fechado hoje, feriado de São
  João · abre quinta às 8h".
- Painel (Configurações › Atendimento e contato): campos "Intervalo, das / às", opcionais.
- As cinco serventias com almoço ganham o intervalo na própria configuração em código.

## Não-objetivos

- Horário diferente por dia da semana (sábado, sexta reduzida). Continua segunda a sexta.
- Feriados municipais (item III do §6º). Cada município tem os seus, e não estão levantados;
  ficam para outra change, junto com as datas fechadas próprias que a agenda já tem.
- Feriado estadual remarcado por decreto (a Lei 8.913/2006 permite antecipar). O calendário
  segue a data da lei.
- Abertura e fechamento em meia hora. Só o intervalo aceita minutos, porque é o único caso real.
- Mexer na grade de agendamento: o intervalo é do balcão, não das faixas da agenda.
- Qualquer alteração de banco que apague ou renomeie coluna, tabela ou dado.

## Capabilities

### New Capabilities

- `counter-hours`: horário do balcão com intervalo opcional, o cálculo de aberto/fechado e o
  texto de status único que o site inteiro usa.

### Modified Capabilities

- `public-home`: cartão de horário com status ao vivo, também no celular.
- `admin-office-settings`: edição do intervalo junto com abertura e fechamento.

## Impact

- `src/core/tenant/schema.ts`, `src/core/tenant/overrides.ts`: schema do intervalo e herança do
  intervalo da config quando a linha salva no painel é anterior a ele.
- `src/core/chat/hours.ts`: cálculo em minutos, `counterStatus` e `counterStatusLabel`.
- `src/core/scheduling/calendar.ts`: dias sem expediente do RN, com nome; muda a contagem de dia
  útil de prazos, agenda e editais (calculados na leitura, nada gravado muda).
- `src/app/globals.css`: animação `hours-halo`.
- `src/core/tenant/seo.ts`: duas `OpeningHoursSpecification` quando há intervalo.
- `src/app/(public)/page.tsx`, `src/app/(public)/contato/page.tsx`,
  `src/app/(public)/_components/chat-widget.tsx`: leitura do novo status.
- `src/app/admin/(dashboard)/configuracoes/`: dois campos novos no formulário e na action.
- `src/core/tenant/tenants/{canguaretama,brejinho,taipu,tibau-do-sul,macaiba-1}.ts`.
- Banco: nenhuma migração. O override já é JSON (`tenant_content.published`).
