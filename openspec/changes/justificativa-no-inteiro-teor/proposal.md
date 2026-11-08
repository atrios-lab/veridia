## Why

O inteiro teor reproduz o registro por completo, com o que ele tiver de adoção, reconhecimento de filho, mudança de nome ou de sexo e disposições de testamento. Hoje só o verbum ad verbum do RCPN pede o motivo. O inteiro teor de imóveis, a certidão de testamento e a gratuidade com inteiro teor saem sem nenhuma justificativa, e a serventia não tem como conferir para que os dados sensíveis serão usados (LGPD, art. 6º, I).

## What Changes

- Todo pedido de inteiro teor passa a pedir o **motivo do pedido**, com um aviso de que a certidão pode trazer dados sensíveis e de que a serventia analisa o motivo antes de emitir.
- **Imóveis:** a opção "Certidão de inteiro teor digital" e o ato "Certidão de inteiro teor em papel de segurança" pedem o motivo. Matrícula e ônus continuam sem.
- **RTD e RCPJ:** "Certidão do registro" passa a perguntar "Qual certidão?", entre breve relato e inteiro teor. Só o inteiro teor pede o motivo.
- **Notas:** "Certidão de ato notarial" passa a perguntar "De qual ato?", entre escritura, procuração ou ata e testamento. Só o testamento pede o motivo.
- **Gratuidade:** quando o tipo de certidão é inteiro teor, o motivo é pedido, salvo no óbito.
- **RCPN:** o verbum ad verbum continua como está, e o campo passa a se chamar "Motivo do pedido".
- O campo vira "Motivo do pedido" no site, no balcão, no painel e no PDF.
- O servidor recusa o motivo em pedido que não o pergunta, como já faz com as perguntas de quem pede.
- A política de privacidade cita o motivo em todo inteiro teor.

## Non-goals

- **Perguntas de quem pede fora do RCPN:** imóveis, RTD, RCPJ, testamento e gratuidade pedem só o motivo, sem papel, representado nem parentesco.
- **Regra própria do testamento:** o site não decide quem pode pedir a certidão de testamento em vida do testador. A serventia analisa.
- **Trava por conteúdo do motivo:** o site não julga se o motivo basta.
- **Migração:** o motivo usa a coluna `purpose`, e as opções novas vão em `details.actVariant`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: motivo obrigatório em todo inteiro teor e opções novas em Notas, RTD e RCPJ.
- `admin-service-requests`: o detalhe mostra e edita o motivo onde o pedido o pergunta.

## Impact

- `src/core/acts/catalog.ts`: `ActVariant.requiresPurpose`, opções novas e textos do campo.
- `src/core/request/kinds.ts`: `asksPurpose` passa a olhar a opção e a gratuidade.
- `src/core/request/form.ts`, `src/core/request/edit.ts`: validação e gravação.
- `src/app/(public)/solicitar/request-form.tsx`, `src/app/admin/(dashboard)/pedidos/`: campo no site, no balcão e no painel.
- `src/core/request/requerimento.ts`: rótulo no PDF.
- `src/app/(public)/privacidade/page.tsx`.
