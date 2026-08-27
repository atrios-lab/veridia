## 1. Dados

- [ ] 1.1 Nova tabela em `src/db/schema.ts` (ex.: `emailBounces`): `email` como chave primária,
  `kind` (o tipo do provedor, texto), `detail` (a descrição do provedor), `permanent` (boolean, a
  decisão já resolvida na escrita, para a leitura no caminho de envio ser um índice e um
  booleano), `tenantSlug` da mensagem que voltou, `occurredAt`. Sem chave estrangeira para
  usuário ou pedido: quem devolve é a caixa, não o registro.
- [ ] 1.2 `pnpm db:generate` e revisar a migração (aditiva, sem passo destrutivo).

## 2. Núcleo (`src/core/email`)

- [ ] 2.1 `bounce.ts`: a classificação do tipo do provedor em permanente ou temporário, como
  função pura sobre o `Type`/`TypeCode` do Postmark. Permanente: HardBounce, BadEmailAddress,
  SpamNotification, ManuallyDeactivated, Unsubscribe, e a supressão. Temporário e tudo o mais:
  não bloqueia.
- [ ] 2.2 Schema Zod do corpo do webhook, aceitando só os campos usados. O corpo vem de fora e é
  dado, nunca instrução.
- [ ] 2.3 Testes (`node --test`) da classificação e do parse, com um corpo real de exemplo do
  Postmark e um malformado.

## 3. Endpoint (`src/app/api/postmark/bounce/route.ts`)

- [ ] 3.1 `POST` que lê o segredo de `POSTMARK_WEBHOOK_SECRET`, compara com
  `crypto.timingSafeEqual` (comprimentos diferentes recusam antes, sem lançar), e recusa quando a
  variável não está definida. Nunca ecoar o segredo, nem dizer qual metade falhou.
- [ ] 3.2 Validar o corpo com o schema da 2.2, classificar com a 2.1, gravar por `email` com
  upsert (`onConflictDoUpdate`), e responder 200 mesmo para tipo que não bloqueia — o provedor
  reenvia o que não for aceito, e não queremos reentrega de um aviso já processado.
- [ ] 3.3 Nada de `getSession` nem `getTenant` aqui: quem chama é o Postmark, sem cookie e sem
  host de serventia. O `tenantSlug` sai do corpo (a mensagem carrega de quem era), ou fica nulo.

## 4. Recusa no envio (`src/lib/email/send.ts`)

- [ ] 4.1 Antes do `fetch`, consultar a tabela pelo destinatário resolvido (depois do
  `resolveRecipient`, para que o desvio de teste não seja bloqueado pelo retorno do endereço
  original) e lançar um erro próprio, exportado, quando houver retorno permanente.
- [ ] 4.2 A consulta é por chave primária. Um `select` por e-mail enviado é barato e evita a
  alternativa, que seria um cache com invalidação — complexidade que só se paga em volume que
  esta plataforma não tem.
- [ ] 4.3 O erro carrega o endereço e a descrição do provedor, para a action montar a frase.

## 5. Mensagem nas actions que enviam

- [ ] 5.1 Nas server actions que já capturam falha de envio (`usuarios/actions.ts`,
  `pedidos/[protocolo]/actions.ts`, e as de ouvidoria/LGPD que respondem ao cidadão), distinguir
  o erro da 4.3 do erro genérico do provedor e mostrar a frase específica: qual endereço não
  recebe e por quê.
- [ ] 5.2 Manter o `console.error` que já existe nesses catches. O erro de endereço morto é
  esperado e explicado, mas continua sendo um envio que não aconteceu.

## 6. Operação

- [ ] 6.1 `POSTMARK_WEBHOOK_SECRET` em `.env.example`, com o que é e onde é usado.
- [ ] 6.2 Documentar o passo do Postmark (aba Webhooks do stream `outbound`, evento Bounce,
  URL do endpoint com o segredo) onde alguém vá ler — README ou o próprio `.env.example`.
  Sem esse passo a tabela nunca recebe nada e o sistema se comporta como hoje.

## 7. Verificação

- [ ] 7.1 Teste (`node --test`, padrão de `src/db/*.test.ts` com PGlite): gravar um retorno
  permanente e conferir que a consulta do caminho de envio o encontra; gravar um temporário e
  conferir que não bloqueia.
- [ ] 7.2 Teste: segundo aviso para o mesmo endereço atualiza a linha em vez de duplicar.
- [ ] 7.3 Teste do endpoint: sem segredo recusa; com segredo errado recusa; sem a variável
  configurada recusa mesmo com corpo válido.
- [ ] 7.4 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens`, `pnpm check:dashes`,
  `pnpm check:destructive`.
