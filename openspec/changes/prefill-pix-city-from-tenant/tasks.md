## 1. Schema: `municipality` estrutural, `pix.city` removido

- [x] 1.1 Adicionar `municipality: z.string()` (obrigatório) a `TenantSchema`
      (`src/core/tenant/schema.ts`), reaproveitando `isValidPixCity`/`PIX_CITY_MAX_LENGTH` de
      `src/core/tenant/pix.ts` na validação (mesma regra hoje aplicada a `pix.city`).
- [x] 1.2 Remover `city` do objeto `pix` em `TenantSchema` (schema, comentário e o `superRefine`
      que valida `value.city`).
- [x] 1.3 Confirmar que `OfficePixSchema`/`OfficePixOverrideSchema`
      (`src/core/tenant/overrides.ts`) não precisam de edição própria — ambos derivam de
      `TenantSchema.shape.pix` via `.pick`/`.unwrap`, então perdem `city` automaticamente.

## 2. Backfill dos tenants existentes

- [x] 2.1 Preencher `municipality` em `src/core/tenant/tenants/bom-jesus.ts` ("BOM JESUS"),
      `taipu.ts` ("TAIPU"), `santa-cruz.ts` ("SANTA CRUZ") e `marinho.ts` ("IELMO MARINHO") — a
      partir da cidade já presente no `address` de cada um.
- [x] 2.2 Preencher `municipality` em `aurora.ts`, `bento-fernandes.ts` e `major-sales.ts` — sem
      `address` cadastrado, usar a cidade já citada no `subtitle`/slug de cada um ("AURORA",
      "BENTO FERNANDES", "MAJOR SALES").
- [x] 2.3 Rodar `parseTenant`/os testes de schema para confirmar que todos os tenants validam com
      o campo novo obrigatório.

## 3. Núcleo: payload Pix e verificação de disponibilidade do QR

- [x] 3.1 Atualizar `canBuildPixCharge` (`src/core/payment/pix-charge.ts`) para pedir só
      `amountCents` e `pixKey` — remover o parâmetro `city`.
- [x] 3.2 Atualizar `src/lib/pix-qr.ts` para ler `tenant.municipality` (em vez de
      `tenant.pix?.city`) e passar para `buildPixCharge`/`canBuildPixCharge`.
- [x] 3.3 Atualizar `src/core/payment/pix-charge.test.ts`: os testes de `canBuildPixCharge` param
      de exercitar o caso "sem cidade" (ele deixa de existir); os testes de `buildPixCharge` que
      hoje passam `city` inline continuam iguais (o parâmetro do payload em si não muda, só a
      origem do valor fora do núcleo).

## 4. Aba Cobrança: remover o campo Cidade

- [x] 4.1 Remover o campo "Cidade" de `pix-key-form.tsx` (label, input, erro de campo, aviso "sem
      cidade" — o aviso "sem chave" continua, agora como única condição de degradação).
- [x] 4.2 Remover a validação e gravação de `city` em
      `src/app/admin/(dashboard)/configuracoes/cobranca/actions.ts` (`savePixKey`): tipo e valor
      da chave voltam a ser os dois únicos campos.
- [x] 4.3 Atualizar `PixKeyValues`/`PixKeyState` (mesmo arquivo) removendo `city` do tipo.

## 5. Specs e verificação final

- [x] 5.1 Confirmar que o delta de spec deste change (`pix-charge-qr`) bate com o comportamento
      implementado; ajustar cenários se a implementação revelar um caso não previsto no design.
- [x] 5.2 Rodar a suíte de testes do núcleo (`node --test`) e os testes Playwright que cobrem a
      aba Cobrança e a consulta de protocolo com QR Pix.
- [x] 5.3 Testar manualmente no navegador: aba Cobrança sem campo Cidade, e a consulta de
      protocolo gerando QR para uma serventia com chave cadastrada (sem precisar reabrir a aba
      Cobrança).
