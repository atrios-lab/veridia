## Context

Os quatro canais compartilham a tabela `service_requests` e a coluna `status`, que é `text`. Cada
canal tem seu vocabulário próprio, declarado em `STATUS_LABELS` (`src/core/request/kinds.ts`), e
seu conjunto de andamentos terminais em `TERMINAL_STATUSES`, que é o que `openCountByKind` usa
para dizer quantos registros ainda pedem atenção.

O canal `ombudsman` declara quatro andamentos e o painel só sabe escrever dois: `new`, no
formulário público, e `answered`, em `respondToRecord`. `in-review` e `done` são rótulos sem
escritor. E como `respondToRecord` só é oferecida quando há nome ou contato
(`page.tsx:132`), manifestação anônima nasce aberta e morre aberta.

A máquina para mover o registro já existe e está parada: `updateRecordStatus`
(`src/lib/service-request.ts:234`) é genérica por kind, grava auditoria e não tem um único
chamador — foi escrita para agendamento, que depois ganhou tabela própria.

O molde de tela também existe: `StatusSection` em `/admin/pedidos` faz pills de "Mudar para" mais
um `<details>` de correção, sobre `suggestedNextStatuses` e `isAllowedTransition`.

## Goals / Non-Goals

**Goals:**

- Dar saída a toda manifestação, com ou sem contato, e devolver sentido ao contador de abertas.
- Reaproveitar o que já existe: `updateRecordStatus`, o padrão de Server Action por tela, o
  vocabulário de andamentos em `core/request/kinds.ts`.
- Manter a regra no núcleo puro: quais andamentos o canal tem, o que cada um sugere como próximo
  passo e o que o servidor aceita são funções sem I/O, testáveis com `node --test`.

**Non-Goals:**

- Máquina de estados, prazo legal, filtro de fila, responsável, aviso por e-mail de andamento.
  Todos estão nomeados como não-objetivos na proposta e valem aqui.
- Generalizar a tramitação para os quatro canais. LGPD tem três andamentos e um prazo de lei;
  agendamento saiu para tabela própria. Uma abstração compartilhada agora seria uma interface com
  uma implementação.

## Decisions

### Andamentos do canal viram lista nomeada, ao lado dos rótulos

`STATUS_LABELS.ombudsman` já enumera o vocabulário, mas é um `Record<string, string>` privado do
módulo e serve para *nomear*, não para *iterar*. Entra uma `OMBUDSMAN_STATUSES` exportada, no
mesmo formato de `SERVICE_REQUEST_STATUSES`, com os cinco valores, mais o tipo derivado e o
predicado `isOmbudsmanStatus`.

*Alternativa descartada:* derivar a lista das chaves de `STATUS_LABELS.ombudsman`. Funciona hoje e
quebra em silêncio no dia em que um rótulo legado for mantido só para não vazar valor cru na
consulta — exatamente o que `STATUS_LABELS.appointment` já faz, com cinco andamentos que ninguém
mais escreve. Lista explícita.

### `archived` entra; `TERMINAL_STATUSES.ombudsman` passa a três

`done` e `archived` são ambos terminais e dizem coisas diferentes: uma manifestação tratada e uma
manifestação sem o que tratar. A serventia pediu as duas palavras por nome. É uma entrada em
`STATUS_LABELS`, uma em `TERMINAL_STATUSES` e um estilo no badge — não é abstração nova.

*Alternativa descartada:* só `done`, com a distinção na anotação interna. Mais barato em uma linha
e mais caro na fila, porque "Concluída" numa denúncia improcedente é o painel afirmando algo que
não aconteceu.

### `answered` fica fora do bloco de tramitação

Responder é enviar texto ao cidadão. Uma pill "Respondida" gravaria o andamento sem resposta e sem
e-mail, e a consulta do cidadão mostraria "Respondida" sem nada para ler. O bloco alcança quatro
dos cinco; `answered` continua saindo só de `respondToRecord`.

Como consequência, `suggestedNextStatuses` do canal nunca oferece `answered`, e a ação recusa esse
destino explicitamente — não por ser inválido no canal, mas por ser inalcançável por esta porta.

### Validação no servidor: pertence ao canal, e não é o atual

A ação recebe o destino e checa duas coisas, nesta ordem: é um dos cinco andamentos do canal (a
coluna é compartilhada, então `pre-noted` chegaria sem erro de tipo pelo formulário), e é diferente
do atual. Fora isso, aceita — inclusive voltar de `archived` para `in-review`. É a mesma decisão já
tomada e comentada em `isAllowedTransition` para o pedido, pela mesma razão: correção de erro
humano é caso de uso.

Recusar `answered` é a terceira checagem, pela razão acima.

### A tramitação é um bloco no card existente, não uma cópia de `StatusSection`

`StatusSection` desenha uma timeline de cinco passos sobre um `HAPPY_PATH` e agrupa dezoito opções
por fase num `<select>`. A ouvidoria tem quatro andamentos alcançáveis e uma linha do caminho
feliz: recebida → em apuração → respondida. Copiar a timeline seria decorar três círculos.

O bloco entra no rodapé do card do detalhe, depois da resposta ou da anotação: pills de sugestão
mais um `<details>` "Corrigir para outro andamento" com os quatro num `<select>` plano. Sem
`optgroup`, que existe em pedidos porque dezoito opções são uma parede.

*Alternativa descartada:* extrair um `<StatusPills>` compartilhado entre pedidos e ouvidoria. Os
dois divergem em timeline, agrupamento e cores; o denominador comum seria um `<form>` com um
botão.

### Uma ação nova, `changeManifestationStatus`, no arquivo de actions da tela

Segue o padrão das três que já estão lá: `authorize()`, lê o `FormData`, chama a função de
`lib/service-request.ts`, `revalidatePath("/admin", "layout")`, devolve `ActionState`. Chama
`updateRecordStatus` com `action: "ombudsman.status"`.

Uma única chave de auditoria para as quatro pills, não uma por destino: o histórico já mostra a
data e o autor, e o andamento de destino é lido do próprio registro. Rótulo em `HISTORY_LABELS` e
em `admin-overview.ts` — "alterou o andamento".

*Trade-off aceito:* o histórico diz que o andamento mudou, não para qual. A auditoria hoje não tem
coluna de payload, e criar uma para esta tela seria migração. Se a serventia sentir falta, a saída
barata é uma chave por destino (`ombudsman.status.done` e irmãs), sem tocar no schema.

### A linha do tempo da consulta passa a ler o andamento

`OmbudsmanCard` (`protocol-lookup.tsx:1514`) escolhe o último passo por `result.reply ? … : "Em
apuração pelo responsável"`. Com `done` e `archived` alcançáveis, uma manifestação identificada
encerrada sem resposta mostraria o badge "Concluída" ao lado de um passo "Em apuração" — o painel
contradizendo a si mesmo na tela do cidadão. O passo passa a seguir o andamento; a resposta segue
sendo mostrada quando existir.

## Risks / Trade-offs

- **Contador cai de uma vez no primeiro uso** → É a correção, não o risco: o número de hoje está
  inflado por manifestações anônimas antigas. Vale avisar a serventia de que a queda é esperada.
- **`archived` numa coluna compartilhada por quatro canais** → Já é o caso: o pedido de serviço
  tem `archived` com outro significado na mesma coluna. Nada lê `status` sem saber o `kind`; o
  cenário "Outros canais não são afetados" da spec de pedidos já guarda essa fronteira.
- **Manifestação identificada encerrada sem resposta deixa o cidadão sem retorno** → A tela não
  impede, de propósito: existe manifestação que se encerra por duplicidade ou por falta de
  conteúdo. O aviso fica na tela, não na regra.
- **Rótulo único de auditoria perde o destino da mudança** → Aceito acima, com a saída barata
  descrita.

## Migration Plan

Nenhuma. `status` é `text`, `archived` é valor novo numa coluna sem enum, e registros existentes
seguem válidos. Rollback é reverter o deploy: registros que já estiverem em `in-review`, `done` ou
`archived` continuam nomeados pela `STATUS_LABELS` anterior nos dois primeiros e caem no genérico
"Em andamento" no terceiro — sem erro, sem valor cru na tela.

## Open Questions

- "Em apuração" tem uso real numa serventia que responde no mesmo dia? Fica na tela porque o
  rótulo já existe e custa uma pill; se ninguém clicar, é uma pill a menos depois.
- Vale um filtro aberto/encerrado na fila antes de o primeiro tenant acumular manifestações
  encerradas? A aposta é que não, e a proposta registra isso como não-objetivo revisável.
