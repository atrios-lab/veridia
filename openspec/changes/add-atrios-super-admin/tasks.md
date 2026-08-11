# Tasks — add-atrios-super-admin

## 1. Núcleo de papéis (src/core/auth)

- [x] 1.1 Adicionar `superadmin` a `ROLES` e dar-lhe todas as permissões em `ROLE_PERMISSIONS` (`src/core/auth/roles.ts`)
- [x] 1.2 Declarar `PANEL_ROLES = ["admin", "staff"]` e a constante do sentinela `SUPERADMIN_TENANT_SLUG = "atrios"` no core de auth
- [x] 1.3 Mudar `canAccessTenant` para `canAccessTenant(role, userTenantSlug, tenantSlug)`: `superadmin` acessa qualquer slug registrado; demais papéis mantêm igualdade estrita
- [x] 1.4 Atualizar `roles.test.ts`: superadmin acessa qualquer tenant registrado (e não um slug não registrado); admin/staff continuam restritos; superadmin tem todas as permissões

## 2. Chokepoints de sessão e login

- [x] 2.1 Passar `session.user.role` ao `canAccessTenant` em `src/lib/session.ts`
- [x] 2.2 Passar o papel ao `canAccessTenant` no sign-in em `src/app/admin/actions.ts` (superadmin não cai mais em `session.denied-tenant`)

## 3. Painel de usuários fora do alcance

- [x] 3.1 Trocar `z.enum(ROLES)` por `z.enum(PANEL_ROLES)` na criação/edição de conta via painel (`src/core/auth/account.ts`) e conferir o formulário de `/admin/usuarios`
- [x] 3.2 Adicionar entrada `superadmin` em `ROLE_LABELS` (`src/app/admin/_components/role-labels.ts`) — exigido pelo tipo
- [x] 3.3 Confirmar que a lista de `/admin/usuarios` filtra por `tenantSlug` do host (sentinela nunca aparece); adicionar asserção em teste existente se houver

## 4. Seed via CLI

- [x] 4.1 Criar `scripts/seed-superadmin.ts` nos moldes de `seed-admin.ts`: fixa `role: "superadmin"` e `tenantSlug: SUPERADMIN_TENANT_SLUG`, valida que o sentinela NÃO é slug registrado
- [x] 4.2 Registrar o script no `package.json` (mesmo padrão dos seeds existentes)

## 5. Verificação

- [x] 5.1 `pnpm typecheck` e `node --test` passando (o typecheck força revisar todo consumidor de `Role`/`ROLES`)
- [x] 5.2 Teste e2e Playwright: superadmin loga em dois hosts de tenant diferentes (`marinho.localhost`, `aurora.localhost`) e alcança o dashboard nos dois; staff de A segue recusado em B com a mensagem genérica
- [x] 5.3 Conferir na trilha de auditoria que o sign-in do superadmin aparece na serventia acessada
