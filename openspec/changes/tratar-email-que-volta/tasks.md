## 1. Dados

- [x] 1.1 Nova tabela em `src/db/schema.ts` (ex.: `emailBounces`): `email` como chave primária,
  `kind` (o tipo do provedor, texto), `detail` (a descrição do provedor), `permanent` (boolean, a
  decisão já resolvida na escrita, para a leitura no caminho de envio ser um índice e um
  booleano), `tenantSlug` da mensagem que voltou, `occurredAt`. Sem chave estrangeira para
  usuário ou pedido: quem devolve é a caixa, não o registro.
- [x] 1.2 `pnpm db:generate` e revisar a migração (aditiva, sem passo destrutivo).

## 2. Núcleo (`src/core/email`)

- [x] 2.1 `bounce.ts`: a classificação, como função pura sobre o `Type` do Postmark. Só o `Type`,
  não o `TypeCode`: dois campos para a mesma decisão dão duas verdades para manter em sincronia.
  Tipo desconhecido não bloqueia — Postmark acrescenta tipos, e um que ninguém ensinou a este
  sistema não pode trancar um cidadão fora do único canal escrito da serventia.
- [x] 2.2 Schema Zod do corpo do webhook, aceitando só os campos usados. O corpo vem de fora e é
  dado, nunca instrução.
- [x] 2.3 Testes (`node --test`) da classificação e do parse, com um corpo real de exemplo do
  Postmark e um malformado.

## 3. Endpoint (`src/app/api/postmark/bounce/route.ts`)

- [x] 3.1 `POST` que lê o segredo de `POSTMARK_WEBHOOK_SECRET`, compara com
  `crypto.timingSafeEqual` (comprimentos diferentes recusam antes, sem lançar), e recusa quando a
  variável não está definida. Nunca ecoar o segredo, nem dizer qual metade falhou. A comparação
  saiu para `src/core/email/webhook-auth.ts`: é a segurança inteira do endpoint, e na rota ela
  não teria teste, porque a rota arrasta `server-only` e o banco junto.
- [x] 3.2 Validar o corpo com o schema da 2.2, classificar com a 2.1, gravar por `email` com
  upsert (`onConflictDoUpdate`), e responder 200 mesmo para tipo que não bloqueia — o provedor
  reenvia o que não for aceito, e não queremos reentrega de um aviso já processado.
- [x] 3.3 Nada de `getSession` nem `getTenant` aqui: quem chama é o Postmark, sem cookie e sem
  host de serventia. O `tenantSlug` sai do corpo (a mensagem carrega de quem era), ou fica nulo.

## 4. Recusa no envio (`src/lib/email/send.ts`)

- [x] 4.1 Antes do `fetch`, consultar a tabela pelo destinatário resolvido (depois do
  `resolveRecipient`, para que o desvio de teste não seja bloqueado pelo retorno do endereço
  original) e lançar um erro próprio, exportado, quando houver retorno permanente.
- [x] 4.2 A consulta é por chave primária. Um `select` por e-mail enviado é barato e evita a
  alternativa, que seria um cache com invalidação — complexidade que só se paga em volume que
  esta plataforma não tem.
- [x] 4.3 O erro carrega o endereço e a descrição do provedor, para a action montar a frase.

## 5. Mensagem nas actions que enviam

- [x] 5.1 Distinguir o erro da 4.3 do genérico. **Custou mais do que o plano previa**, por uma
  descoberta: `notifyCitizen` roda dentro de `after()`, ou seja, o envio ao cidadão acontece
  depois que a action já respondeu — não havia como a falha chegar à tela. A consulta de retorno
  passou a ser feita *antes* de agendar o envio, e `notifyCitizen` devolve a frase pronta; as dez
  chamadas viraram `await`, e o aviso sobe pelo `emailWarning` no estado de sucesso. O envio em
  si continua adiado: quem é lento é o provedor, não uma leitura por chave primária.
- [x] 5.2 Manter o `console.error` que já existe nesses catches. O erro de endereço morto é
  esperado e explicado, mas continua sendo um envio que não aconteceu.

## 6. Operação

- [x] 6.1 `POSTMARK_WEBHOOK_SECRET` em `.env.example`, com o que é e onde é usado.
- [x] 6.2 Documentado no `.env.example`, junto da variável: é onde alguém procura quando vai
  configurar o ambiente, e ali a instrução não tem como ser lida sem o segredo ao lado.

## 7. Verificação

- [x] 7.1 Teste (`node --test`, padrão de `src/db/*.test.ts` com PGlite): gravar um retorno
  permanente e conferir que a consulta do caminho de envio o encontra; gravar um temporário e
  conferir que não bloqueia.
- [x] 7.2 Teste: segundo aviso para o mesmo endereço atualiza a linha em vez de duplicar.
- [x] 7.3 Teste da autenticação (`webhook-auth.test.ts`): segredo errado recusa, ausente recusa,
  comprimento diferente recusa sem lançar, e ambiente sem a variável recusa tudo. O handler HTTP
  em si não tem teste — precisaria de um `Request` e do banco, e o que ele acrescenta sobre estas
  quatro linhas é a leitura de um header e de uma query string.
- [x] 7.4 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens`, `pnpm check:dashes`,
  `pnpm check:destructive`.

## 8. Fora do escopo desta change

- [ ] 8.1 Avisar o cidadão, nos três formulários públicos (`solicitar`, `lgpd`, `ouvidoria`),
  quando o endereço que ele mesmo digitou não recebe. As chamadas já estão `await`, então a
  informação existe no momento certo; falta decidir a tela, que é outra conversa: ali o endereço
  é da própria pessoa e a mensagem certa é "confira o e-mail", não "avise por telefone".
