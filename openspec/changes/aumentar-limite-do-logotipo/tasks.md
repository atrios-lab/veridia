## 1. Núcleo (regra pura)

- [x] 1.1 Em `src/core/tenant/brand-image.ts`, trocar `LOGO_MAX_BYTES` de `1 * 1024 * 1024` para
      `3 * 1024 * 1024`.
- [x] 1.2 Atualizar `src/core/tenant/brand-image.test.ts`: os testes que hoje esperam o limite de
      1 MB (`"a logo over 1 MB is rejected"`, `"a hero photo may be up to 4 MB, unlike a logo"`,
      `"the seal carries the logotype's 1 MB limit, not the hero's"`) passam a exercitar e a
      afirmar o teto de 3 MB.

## 2. Tela de Identidade Visual

- [x] 2.1 Em `visual-identity-form.tsx`, atualizar o texto de dica do bloco "Logotipo" de "até 1
      MB" para "até 3 MB".

## 3. Verificação

- [x] 3.1 Rodar `node --test src/core/tenant/brand-image.test.ts` e confirmar que passa.
- [x] 3.2 Cobrir em `e2e/admin-visual-identity.spec.ts` os dois cenários da spec: logotipo acima
      de 3 MB recusado com a mensagem do limite; logotipo de 2 MB aceito. Não rodou localmente:
      o usuário seed do Homolog é `staff`, sem `branding.edit`, e a tela devolve 404 — o mesmo
      vale para os testes já existentes desse arquivo.
