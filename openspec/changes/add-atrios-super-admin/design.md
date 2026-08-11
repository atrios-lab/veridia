# Design — Admin geral da Átrios (superadmin)

## Context

Todo acesso ao painel converge em dois chokepoints que chamam `canAccessTenant(userTenantSlug, tenantSlug)` (`src/core/auth/roles.ts:58`): `src/lib/session.ts` (toda leitura de sessão em rota protegida) e `src/app/admin/actions.ts` (sign-in, que encerra a sessão e audita `session.denied-tenant` quando o domínio não bate). A resolução de tenant é por host (`resolveTenant` / `getTenant()`), o vínculo usuário→serventia é a coluna `user.tenant_slug` (texto, NOT NULL, sem tabela de membership), e papéis são o const tuple `ROLES = ["admin", "staff"]` com permissões em `ROLE_PERMISSIONS`.

O change implementado `scope-admin-to-tenant` estabeleceu "todo usuário pertence a exatamente uma serventia, sem conta que abre todas". Este design revoga essa restrição exclusivamente para o papel de plataforma.

## Goals / Non-Goals

**Goals:**

- Uma conta da Átrios entra no `/admin` de qualquer serventia registrada e opera o painel dela com todas as permissões.
- Nenhuma mudança de comportamento para `admin` e `staff`.
- Zero migração de banco e zero mecanismo novo de sessão/navegação.

**Non-Goals:**

- Painel de plataforma, visão agregada cross-tenant, seletor de serventia, "acting tenant" em cookie/sessão, impersonation, papel somente-leitura, convite por e-mail para superadmin (ver Não-objetivos do proposal).

## Decisions

### 1. Troca de serventia = troca de domínio (nenhum seletor)

Como o tenant já é resolvido por host e o painel herda o tema do tenant da sessão, o superadmin acessa o cartório X entrando em `x.dominio/admin`. `getTenant()` fica intocado — o arquivo argumenta explicitamente contra um segundo getter, e um "acting tenant" em cookie criaria um canal paralelo de resolução que todas as queries scoped por `tenantSlug` teriam que respeitar.

*Alternativa rejeitada:* seletor de serventia com override em cookie. Exige tocar `getTenant()`, o cache por request, o middleware edge e cada ponto que assume host==tenant. Custo alto, ganho é só conveniência de navegação.

### 2. Exceção no papel, não no vínculo

`canAccessTenant` ganha o papel na assinatura: `canAccessTenant(role, userTenantSlug, tenantSlug)`. Para `superadmin`, retorna verdadeiro para qualquer slug registrado; para os demais, comportamento atual (igualdade estrita + registro). Os dois chokepoints já têm `session.user.role` em mãos — a mudança é passar um argumento a mais.

*Alternativa rejeitada:* tabela de membership (superadmin membro de todos os tenants). Modela errado (superadmin não é "membro"), exige migração, e cada novo tenant exigiria nova linha.

### 3. `tenantSlug` sentinela `"atrios"`

A coluna é NOT NULL e `required: true` no better-auth; um usuário sem tenant não é representável sem migração. O sentinela `"atrios"` não é slug registrado, então: nunca casa com host algum (sem acesso acidental por igualdade), e a lista de `/admin/usuarios` — que filtra por `tenantSlug` da serventia do host — nunca exibe superadmins. Nenhum código de tenant precisa conhecer o sentinela; só o script de seed o usa.

*Alternativa rejeitada:* tornar a coluna nullable. Migração + todo consumidor de `tenantSlug` precisaria tratar null.

### 4. Criação só por CLI, papel invisível ao painel

`scripts/seed-superadmin.ts` nos moldes de `seed-admin.ts`, sem a validação `isRegisteredSlug` (fixa o sentinela). O schema de criação de conta pelo painel (`src/core/auth/account.ts`) passa a validar contra `PANEL_ROLES = ["admin", "staff"]` em vez de `ROLES` — um registrador não pode criar nem promover ninguém a superadmin. `ROLE_LABELS` ganha a entrada (`superadmin` → "Átrios") porque o tipo `Record<Role, string>` exige.

### 5. Auditoria: nada novo

`auditLog` já grava por `tenantSlug` da serventia acessada, e sign-in/sign-out/ações já passam por `src/lib/audit.ts`. Ações do superadmin no cartório X aparecem na trilha do cartório X identificadas pelo usuário — que é o requisito. Sem evento novo.

## Risks / Trade-offs

- [Credencial superadmin vira chave-mestra da plataforma] → criação só via CLI (sem fluxo de convite atacável), rate-limit de login existente se aplica, e toda ação fica auditada por serventia. Rotação de senha via CLI.
- [Contradiz o spec `admin-tenant-scope` implementado ("sem conta que abre todas")] → revogação deliberada e registrada: o delta de `admin-auth` e o novo spec `platform-super-admin` documentam a exceção; o texto antigo vale para papéis de serventia.
- [Sentinela `"atrios"` é uma string mágica] → vive em um único lugar (constante no core de auth, usada pelo seed); se um dia registrarem um tenant `atrios`, o slug colide — o seed valida que o sentinela não é slug registrado.
- [Superadmin em dropdowns/telas que iteram `ROLES`] → o typecheck (`Record<Role, ...>`) força revisar cada consumidor; o formulário de usuários usa `PANEL_ROLES`.

## Migration Plan

Sem migração de banco (`role` e `tenant_slug` são text). Deploy único; rollback é reverter o commit — contas superadmin existentes ficam inertes (papel desconhecido não passa em `can()` nem em `canAccessTenant` antigos).

## Open Questions

- Nenhuma bloqueante. Rótulo exibido ("Átrios") pode ser ajustado depois sem impacto.
