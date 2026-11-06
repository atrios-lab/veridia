## Context

O catálogo (`src/core/acts/catalog.ts`) é nacional e tem atos que agrupam tipos no nome. O pedido guarda só `actId`, e o tipo fica, quando muito, na descrição livre.

Pontos do código que limitam a solução:

- `publicServiceRequestSchema` e `serviceRequestSchema` compartilham `actRules`, e o cliente valida com o mesmo schema do servidor.
- `src/core/request/form.ts` não pode importar valores de `catalog.ts`: isso fecha o ciclo descrito no início do arquivo. `actRules` recebe o `Act` por parâmetro, então pode ler o que ele traz.
- `details` é JSONB e já guarda o que pertence só a esse tipo de registro, como o telefone. A migração de produção é manual, então evitar coluna nova reduz o risco de deploy.
- `findOpenServiceRequestDuplicateWith` compara tenant, ato e cidadão, conforme a change `avisar-protocolo-duplicado`, e só o site público a chama.
- `requestDataEditSchema` e `updateRequestData` já corrigem dados protocolados e já fazem merge do telefone em `details`.

## Goals / Non-Goals

**Goals:**

- Registrar o tipo como dado estruturado, nos dois canais.
- Mostrar o nome específico onde o nome do ato já aparece para operador e cidadão.
- Parar de tratar tipos diferentes do mesmo ato como pedido duplicado.
- Não mudar prazo, valor, documentos, declaração nem o hash do aceite.

**Non-Goals:**

- Os não-objetivos estão em `proposal.md`.

## Decisions

### 1. Os tipos ficam no próprio ato

`Act` ganha um campo opcional:

```ts
variants?: {
  question: string; // label of the select
  options: { id: string; name: string; requiresDescription?: true }[];
};
```

`name` é o nome completo ("Certidão de casamento"), usado tanto na opção do select quanto no painel. Assim um único texto atende as duas telas, sem compor "ato + tipo" em cada leitor.

**Alternativa descartada:** dividir cada ato em vários atos do catálogo. Isso multiplicaria os cards da etapa 2, que hoje ajudam justamente por agrupar, e mudaria `actId` de quem já referencia o ato (gratuidade, Anexo I).

### 2. O tipo fica em `details.actVariant`

Grava-se o `id` da opção, com `actVariant: z.string().optional()` em `serviceRequestDetailsSchema` e um `readActVariant(details)` ao lado de `readPhone`. O campo fica fora de `details.exemption`, então o hash do aceite não muda.

**Alternativa descartada:** coluna nova em `service_requests`. Ela seria usada só por um dos quatro tipos de registro, exigiria migração manual e nada filtra ou indexa por tipo.

### 3. A validação fica em `actRules`

`actRules` resolve de quem são os tipos: do ato escolhido na gratuidade quando `act.exemptionTargets` existe, senão do próprio `act`. Depois aplica três regras: tipo obrigatório quando há opções, tipo precisa pertencer às opções e tipo recusado quando não há opções. Se a opção tiver `requiresDescription`, a descrição passa a ser obrigatória.

O campo `actVariant` entra em `commonFields` tratando nulo e vazio como ausente, como `exemptionActId`. As duas actions passam a ler `formData.get("actVariant")`.

### 4. Um único helper resolve o nome

`actVariantName(act, variantId)` em `catalog.ts` devolve o nome do tipo, ou `undefined` se o id estiver ausente ou não existir mais. Cada leitor faz `actVariantName(...) ?? act.name`. Assim o id cru nunca aparece e pedido antigo mantém o nome do ato.

Leitores atualizados: detalhe, selo da gratuidade, fila, tela de sucesso, consulta do protocolo e requerimento. Na gratuidade, o tipo pertence ao ato pedido, então o helper recebe esse ato. O campo "Ato" e a consulta continuam "Solicitar gratuidade (isento)", e o tipo aparece no selo e no requerimento.

### 5. O duplicado filtra pelo tipo em SQL

`findOpenServiceRequestDuplicateWith` recebe `actVariant` opcional. Quando presente, acrescenta `details->>'actVariant' = $1` ao `WHERE`. O filtro precisa estar no `WHERE`, porque a consulta usa `ORDER BY ... LIMIT 1`: filtrar depois olharia só o pedido mais recente.

O pedido aberto sem tipo não casa com o filtro e não bloqueia. Barrar seria repetir o problema que esta change corrige, e o pior caso é um pedido a mais durante a transição.

Na gratuidade, tipos diferentes também deixam de bloquear. Quando o novo pedido não tem tipo, a regra continua sem filtro, inclusive entre atos da gratuidade: essa limitação já existe e fica fora do escopo.

### 6. Select nativo com o padrão do agendamento

O select segue `src/app/(public)/agendar/appointment-form.tsx`: `<select>` nativo, `inputClass` e primeira opção vazia e desabilitada ("Escolha uma opção"). No site, ele fica entre a linha de telefone e CPF e a descrição. Na gratuidade, fica no bloco próprio, porque o ato só é escolhido depois da descrição.

No site, `useForm` não usa `shouldUnregister`, então trocar o ato da gratuidade precisa limpar o valor com `setValue`. Sem isso, um valor antigo seria reprovado pela validação no cliente. No balcão, o select é recriado com `key` pelo ato em uso.

### 7. A correção valida o tipo no servidor

`updateRequestDataAction` já carrega o pedido e o ato. Uma função pura no núcleo, `resolveVariantEdit(act, exemptionActId, raw)`, decide o resultado: vazio não altera nada, id válido grava e id inválido devolve erro. A regra fica em `src/core` e o merge em `details` vai para `updateRequestDataWith(db, ...)`, para ser testável com PGlite.

O campo "Ato" continua somente leitura. O select de tipo fica logo abaixo dele, só quando há opções.

## Risks / Trade-offs

- **Ids gravados sobrevivem ao catálogo.** Renomear um `id` faria pedidos antigos voltarem ao nome agrupado. → Os ids são estáveis, em minúsculas e sem acentos; um teste fixa a lista. O `name` pode mudar sem afetar nada gravado.
- **Cidadão escolhe o tipo errado.** → O operador corrige no detalhe, com registro no histórico.
- **Consulta sem índice em `details`.** → A consulta já restringe por tenant, ato e cidadão antes do filtro, e o volume por cidadão é pequeno.
- **Nomes dos tipos de RI podem não ser os usados no balcão.** → Os textos ficam só no catálogo e mudam sem migração.
- **Dois pedidos do mesmo tipo para pessoas diferentes continuam barrados.** → Limitação existente, registrada nos não-objetivos.

## Migration Plan

Não há migração de banco nem backfill: pedidos antigos ficam sem `actVariant` e mostram o nome do ato. Para reverter, basta voltar o deploy; a chave extra em `details` é ignorada pelo schema antigo.

## Open Questions

Nenhuma que bloqueie a implementação. A serventia pode revisar depois os nomes dos tipos de RI.
