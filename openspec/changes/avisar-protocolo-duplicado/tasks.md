## 1. Núcleo e camada de dados

- [x] 1.1 Em `src/lib/service-request.ts`, adicionar `findOpenServiceRequestDuplicate` que busca um `service-request` existente com o mesmo `tenantSlug` + `actId` e status não terminal (usar `isOpenServiceRequestStatus` de `src/core/request/kinds.ts`), identificando o cidadão pelo CPF quando informado (com fallback para e-mail) ou só pelo e-mail quando não — CPF é opcional no formulário público, e-mail não
- [x] 1.2 Definir o retorno de "duplicado" (`SubmitDuplicate = { status: "duplicate", protocolNumber }`) devolvido antes de criar qualquer registro

## 2. Server action

- [x] 2.1 Em `src/app/(public)/solicitar/actions.ts`, chamar `findOpenServiceRequestDuplicate` em `submitServiceRequest` (antes de `collectAttachments`, para não deixar anexo órfão) e retornar `SubmitDuplicate` quando encontrar

## 3. UI pública

- [x] 3.1 Criar `DuplicateRequestDialog` (`src/app/(public)/solicitar/_components/duplicate-dialog.tsx`), `<dialog>` nativo com `showModal()` no padrão do admin mas com tokens `brand-*` públicos, com o número do protocolo e link para `/protocolo?numero=<protocolNumber>`
- [x] 3.2 Em `src/app/(public)/solicitar/request-form.tsx`, abrir o diálogo quando `submitServiceRequest` retornar `status: "duplicate"`; fechar deixa o formulário intacto

## 4. Specs e testes

- [x] 4.1 Teste em `src/db/service-request.test.ts` (padrão SQL/PGlite do arquivo) cobrindo a mesma consulta de `findOpenServiceRequestDuplicate`: bloqueado com ato+CPF iguais e status aberto; bloqueado sem CPF, só por e-mail; permitido com status terminal; permitido com ato, CPF e e-mail diferentes — `node --test`, 17/17 passando
- [x] 4.2 Teste Playwright em `e2e/service-request.spec.ts` ("a second request for the same act and CPF shows the duplicate dialog"), no bloco `filing a request` (gated por `DATABASE_URL`, mesmo padrão dos demais); não executável neste sandbox (Chromium do Playwright não alcança `*.localhost` aqui), roda no CI
- [x] 4.3 `openspec validate avisar-protocolo-duplicado --strict` — válido
