## 1. Núcleo: chave Pix e overrides

- [x] 1.1 Criar `src/core/tenant/pix.ts` com `PIX_KEY_TYPES` (`cpf`, `cnpj`, `email`, `phone`,
      `random`), `PixKeyTypeSchema`, `isValidCnpj` (mod-11 sobre os pesos do CNPJ, reusando o
      padrão de `isValidCpf`), `normalizePixKey(type, value)` e `isValidPixKey(type, value)` —
      tudo puro, sem I/O
- [x] 1.2 Criar `src/core/tenant/pix.test.ts` (`node --test`): um caso válido e um inválido por
      tipo, normalização de CPF/CNPJ/telefone formatados, e-mail e UUID em maiúsculas
- [x] 1.3 Acrescentar `pix: z.object({ type, key }).optional()` ao `TenantSchema`, com
      `superRefine` que valida a chave conforme o tipo e aponta o erro para o campo `key`
- [x] 1.4 Em `src/core/tenant/overrides.ts`, acrescentar `OfficeDpoSchema` e `OfficePixSchema`
      (picks de `dpo` e `pix`) com seus `...OverrideSchema` parciais
- [x] 1.5 Trocar a assinatura de `applyTenantOverrides` para
      `(tenant, { contact, brand, dpo, pix })`, mantendo a disciplina de `safeParse` por bloco:
      bloco inválido é ignorado, nunca lançado
- [x] 1.6 Estender `src/core/tenant/overrides.test.ts`: override de DPO válido substitui,
      corrompido é ignorado, override de Pix idem, e um bloco quebrado não derruba os outros

## 2. Permissão e leitura

- [x] 2.1 Acrescentar `billing.edit` a `PERMISSIONS` em `src/core/auth/roles.ts`, presente em
      `admin` e ausente em `staff`
- [x] 2.2 Estender `src/core/auth/roles.test.ts`: `admin` pode, `staff` não pode
- [x] 2.3 Em `src/lib/tenant.ts`, exportar `OFFICE_DPO_KEY` e `OFFICE_PIX_KEY`, incluí-las no
      `inArray` de `readTenantOverrides` e passar os quatro blocos para `applyTenantOverrides`

## 3. Aba Encarregado

- [x] 3.1 Criar `src/app/admin/(dashboard)/configuracoes/encarregado/page.tsx`: exige sessão e
      `content.edit` (`notFound()` se faltar), renderiza `AdminPageHeader`, `ConfiguracoesTabs` e
      o formulário com os valores em vigor
- [x] 3.2 Criar `encarregado/dpo-form.tsx` no mesmo desenho de `office-contact-form.tsx`: nome e
      e-mail, erro por campo, valores ecoados de volta no erro, confirmação de gravação
- [x] 3.3 Criar `encarregado/actions.ts`: relê a sessão, checa `content.edit`, valida com
      `OfficeDpoSchema`, grava em `tenant_content` na chave `office-dpo` direto em `published`,
      chama `recordAudit` e `revalidatePath("/", "layout")`

## 4. Aba Cobrança

- [x] 4.1 Criar `src/app/admin/(dashboard)/configuracoes/cobranca/page.tsx`: exige `content.edit`
      para abrir, calcula `canEdit = can(role, "billing.edit")` e passa para o formulário
- [x] 4.2 Criar `cobranca/pix-key-form.tsx`: seletor de tipo, campo do valor, "Salvar chave" e
      "Remover chave"; com `canEdit` falso, renderiza o bloco em leitura com selo "Somente
      leitura" e sem botões; sem chave cadastrada, mostra o estado vazio e o que ele significa
- [x] 4.3 Criar `cobranca/actions.ts` com `savePixKey` e `removePixKey`: as duas checam
      `billing.edit` no servidor, `savePixKey` valida com `OfficePixSchema` e grava a chave
      normalizada em `office-pix`, `removePixKey` apaga a linha; as duas chamam `recordAudit`
- [x] 4.4 Escrever na tela os dois avisos que a spec exige: o formato é conferido mas a
      titularidade não, e o sistema não sabe quando o Pix cai

## 5. Faixa de abas

- [x] 5.1 Em `_components/tabs.tsx`, dar `href` às abas Encarregado (`content.edit`) e Cobrança
      (`content.edit`), remover os `href: null` e o texto "em breve", e virar a lista num
      `tablist` de verdade agora que as quatro navegam
- [x] 5.2 Ajustar o parágrafo final de `configuracoes/page.tsx` que hoje aponta só para
      Identidade Visual

## 6. Verificação

- [x] 6.1 Estender `e2e/admin-settings.spec.ts`: gravar Encarregado e ver o novo contato na página
      LGPD; salvar chave Pix válida; recusa de chave com formato errado. (Não coberto em e2e:
      "operador sem `billing.edit` sem botão de salvar" — o projeto não tem conta `staff` semeada
      nem infra de seed para papel; comportamento coberto por `roles.test.ts`, que confere que
      `staff` não tem `billing.edit`, e pela leitura direta de `pix-key-form.tsx`, onde `canEdit`
      decide o único ponto de ramificação entre a view editável e a somente leitura.)
- [x] 6.2 Rodar `pnpm test`, `pnpm lint` e o typecheck; conferir que nada mais chama
      `applyTenantOverrides` na assinatura antiga
- [x] 6.3 Abrir as duas abas no preview e conferir contra o design: `Redesign 04 — Admin Config,
      Usuários e Senha`, seções "Configurações — aba Encarregado em tela" e "aba Cobrança em tela".
      Testado ao vivo contra o banco real: Encarregado abre pré-preenchido com o DPO em vigor;
      Cobrança abre no estado vazio; salvar CNPJ formatado grava normalizado
      (`11222333000181`) e sobrevive a reload; chave em formato errado é recusada sem tocar na
      chave anterior; remover chave volta ao estado vazio. Chave de teste removida ao final.
