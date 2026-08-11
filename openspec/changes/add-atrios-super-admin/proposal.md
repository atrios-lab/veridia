# Admin geral da Átrios (superadmin)

## Why

Hoje todo usuário do painel pertence a exatamente uma serventia (`user.tenantSlug`), e `canAccessTenant` barra qualquer acesso cruzado. A equipe da Átrios (operadora da plataforma) precisa acessar o painel de qualquer cartório para suporte, configuração e operação assistida — sem criar uma conta por serventia nem compartilhar credenciais de registradores.

## What Changes

- Novo papel `superadmin` em `ROLES`, com todas as permissões existentes (`ROLE_PERMISSIONS`).
- `canAccessTenant` passa a receber o papel: `superadmin` acessa qualquer tenant registrado; `admin` e `staff` continuam restritos ao próprio (comportamento atual inalterado).
- Superadmin loga no `/admin/login` de qualquer domínio de tenant e opera o painel daquela serventia. Não há seletor de cartório: a troca de serventia é trocar de domínio — a resolução de tenant por host (`getTenant()`) permanece intocada.
- Conta superadmin usa `tenantSlug` sentinela `"atrios"` (não registrado como tenant): não aparece na lista de usuários de nenhuma serventia e nunca casa com um host real.
- Criação de superadmin apenas via script CLI (`scripts/seed-superadmin.ts`); a tela `/admin/usuarios` não oferece o papel — o `z.enum` de criação de conta pelo painel continua aceitando só `admin` e `staff`.
- Todo sign-in e ação de superadmin cai na trilha de auditoria existente com o `tenantSlug` da serventia acessada (o `auditLog` já registra por tenant; sem mecanismo novo).
- Rótulo de exibição do papel em `ROLE_LABELS` (ex.: "Átrios").

## Capabilities

### New Capabilities

- `platform-super-admin`: papel de plataforma da Átrios com acesso a qualquer serventia registrada; criação restrita a CLI, invisível às telas de gestão de usuários dos tenants, auditado por serventia acessada.

### Modified Capabilities

- `admin-auth`: o requisito de recusa indistinguível para "conta de outra serventia" ganha exceção — credencial `superadmin` válida autentica em qualquer host de tenant registrado.

## Não-objetivos

- Painel ou área administrativa da plataforma (visão cross-tenant, dashboards agregados, gestão de tenants pela UI). Superadmin opera cada painel existente, um tenant por vez.
- Seletor de serventia dentro do painel ou "acting tenant" em cookie/sessão. Troca de tenant = troca de domínio.
- Permissões novas ou papel intermediário (ex.: suporte somente-leitura). Superadmin herda as 10 permissões existentes.
- Impersonation de usuários de tenant. Superadmin age como ele mesmo e é auditado como tal.
- Convite/reset de senha por e-mail para superadmin. Criação e credenciais via CLI, como já existe para seed de admin.
- Multi-tenancy real por usuário (tabela de membership). Um superadmin não é "membro de todos"; é uma exceção de papel na checagem de acesso.

## Impact

- `src/core/auth/roles.ts`: `ROLES`, `ROLE_PERMISSIONS`, assinatura de `canAccessTenant` (+ testes em `roles.test.ts`).
- `src/lib/session.ts` e `src/app/admin/actions.ts`: os dois chokepoints que chamam `canAccessTenant` passam o papel.
- `src/core/auth/account.ts`: `z.enum(ROLES)` de criação via painel restringido a `admin`/`staff`.
- `src/app/admin/_components/role-labels.ts`: entrada para `superadmin` (exigido pelo tipo `Record<Role, string>`).
- `src/app/admin/(dashboard)/usuarios/`: lista já filtra por `tenantSlug` da serventia — sentinela `"atrios"` mantém superadmin fora; formulário não oferece o papel.
- `scripts/seed-superadmin.ts` (novo), nos moldes de `seed-admin.ts` sem validação `isRegisteredSlug`.
- Sem migração de banco: `role` e `tenant_slug` são `text`, nenhum enum de banco a alterar.
- Atenção: o change implementado `scope-admin-to-tenant` declara "sem conta que abre todas" — este change revoga deliberadamente essa restrição para o papel de plataforma; o delta de `admin-auth` registra a exceção.
