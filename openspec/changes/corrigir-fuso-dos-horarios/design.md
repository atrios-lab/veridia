## Context

O sistema guarda instantes em colunas `timestamptz`, e o servidor roda em UTC. `OFFICE_TIME_ZONE` existe em `src/lib/office-config.ts` e parte das telas já o usa, como a lista de pedidos e a mesa de trabalho. Outras têm cópias locais de `Intl.DateTimeFormat` sem `timeZone`, e o resultado depende de onde o código roda:

| Onde roda | Fuso usado | Efeito |
|---|---|---|
| Componente do servidor e PDF | UTC | 3 horas adiantado; depois das 21h, o dia seguinte |
| Componente cliente com primeira renderização no servidor | UTC e depois o do aparelho | Valores diferentes entre servidor e navegador |
| Componente cliente após consulta | O do aparelho | Certo só em aparelho em UTC−3 |

Há também dias de calendário (`IsoDate`, "YYYY-MM-DD") tratados como instante. Em `protocol-trilho.tsx`, `new Date("2026-11-20")` é meia-noite em UTC, e um aparelho no Brasil mostra 19/11. Em `protocol-lookup.tsx`, o `T00:00:00` hoje evita esse erro, mas só porque lê e formata no fuso do aparelho.

Restrições: `src/core` não importa de `src/lib`, e os componentes cliente precisam usar o mesmo código, sem `server-only`.

## Goals / Non-Goals

**Goals:**

- Mesmo resultado para o mesmo registro, em qualquer tela, servidor ou aparelho.
- Um único lugar para o fuso e os formatadores.
- Teste que falha se alguém voltar a formatar data sem fuso.

**Non-Goals:**

- Fuso por serventia, mudança no banco ou correção de dados.
- Regravar documentos já entregues ou arquivos já enviados.
- Mudar o formato das datas ou adotar biblioteca de datas.
- Alterar os scripts avulsos em `scripts/`.

## Decisions

### O fuso é `America/Fortaleza`, em um único lugar

Todos os clientes são do Rio Grande do Norte, que não tem identificador próprio na base de fusos; `America/Fortaleza` é o que cobre o estado. Hoje ele dá o mesmo horário de `America/Sao_Paulo`, então a troca não muda nenhum horário. A diferença só aparece se o horário de verão voltar: São Paulo adiantaria, e o Rio Grande do Norte historicamente não adota.

Por isso a change também remove os valores próprios de `src/core/chat/hours.ts`, `contato/page.tsx`, `publication-form.tsx` e `declaracao.ts`. Se ficassem, o sistema se dividiria em dois horários justamente nesse cenário.

### O fuso e os formatadores ficam em `src/core/time/office-time.ts`

Os PDFs são gerados em `src/core`, que não pode importar de `src/lib`, então o módulo precisa estar no núcleo. `office-config.ts` reexporta a constante, e nenhum importador atual precisa mudar.

Alternativa descartada: passar o fuso como parâmetro até `buildRequerimento`. Deixaria o núcleo mais genérico, mas espalha pelas assinaturas um valor que hoje é constante e abre espaço para esquecê-lo. Quando houver fuso por serventia, os formatadores ganham esse parâmetro em um só lugar.

### Formatadores de instante recebem `Date`, e não string

Os tipos não distinguem um instante de um `IsoDate`, porque os dois chegam como string. Exigir `Date` obriga a escrever `new Date(iso)` no ponto de uso, onde o engano fica visível. Telas que recebem strings podem manter uma função local de uma linha que só faz essa conversão.

### Dia de calendário não passa por `Date`

`IsoDate` vai direto para `formatDate` de `calendar.ts`, que apenas reorganiza o texto. Aplicar o fuso da serventia a esses valores não resolveria: meia-noite em UTC continuaria sendo a véspera em UTC−3. É por isso que o `T00:00:00` de `protocol-lookup.tsx` também sai: lido no fuso do aparelho e formatado no da serventia, erraria o dia em aparelhos a leste.

### "Disponível até" é calculado sobre o dia, e não sobre o instante

`addCalendarDays` em `protocol-trilho.tsx` usa `setDate`, que depende do fuso do aparelho. O cálculo passa a ser `toIsoDate`, `addDays` e `formatDate`, o que dá o mesmo dia em qualquer aparelho.

### O ano do protocolo vem de `officeYear(instant)`

A função recebe o instante e o chamador lê o relógio, como o resto do núcleo faz. As respostas falsas ao robô em `solicitar`, `lgpd` e `ouvidoria` mudam junto, para não se distinguirem de um protocolo real na noite de 31/12.

### Um teste varre `src` em busca de formatação sem fuso

O erro nasceu de cópias locais e nada impede a próxima. O projeto não tem regra de lint que exija uma propriedade em uma chamada específica, então a proteção é um teste em `node --test` que varre o código, com a lista explícita dos usos conhecidos que operam sobre dia e não sobre instante (`calendar.ts`, `classification.ts`, `agenda-settings-form.tsx`).

Alternativa descartada: rodar toda a suíte com `TZ=UTC`. Pegaria parte dos casos, mas não os componentes de tela, que não têm teste de formatação.

### Os testes trocam `process.env.TZ` em vez de depender do ambiente

Node aplica a mudança de `process.env.TZ` durante a execução, então o mesmo arquivo prova o resultado em UTC, em São Paulo e em Tóquio, em qualquer máquina. Sem isso, o teste passaria na máquina de quem desenvolve pelo mesmo motivo que escondeu o erro.

## Risks / Trade-offs

- **Reimpressão de pedido antigo muda a data.** O PDF é gerado na hora, então um pedido feito depois das 21h antes da correção passa de 04/11 para 03/11 e pode divergir da via já assinada. → A data nova é a certa; registrar isso na descrição do PR para a serventia saber.
- **A contagem do prazo da LGPD em destaque pode mudar em um dia** para solicitações abertas feitas depois das 21h. → É a correção desejada, e passa a coincidir com as telas de LGPD.
- **Cliente fora do Rio Grande do Norte.** Um estado em outro fuso, ou que adote horário de verão, veria o horário errado. → A constante fica em um só lugar, e o fuso por serventia passa a ser necessário quando esse cliente existir.
- **Scripts avulsos continuam com `America/Sao_Paulo`.** O horário é igual ao de `America/Fortaleza` hoje, e eles não rodam junto com o app. → Revisar só se o horário de verão voltar.
- **O teste de varredura é por texto e pode ter falso positivo ou deixar passar algo.** → Lista de exceções explícita e padrão limitado aos formatos usados no projeto.
- **Citação de "hora local" pelo cidadão.** Quem consulta de outro fuso passa a ver o horário da serventia, sem indicação de fuso. → Aceito: é o mesmo horário que o cartório informa no atendimento.

## Migration Plan

Sem migração e sem ordem de deploy: a mudança é só de leitura e formatação. Para desfazer, basta reverter o PR, porque nenhum dado é alterado. Protocolos criados com a correção não são afetados por uma reversão.
