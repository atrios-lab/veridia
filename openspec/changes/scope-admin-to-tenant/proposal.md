## Why

O painel administrativo nao tem vinculo com serventia. A tabela `user` nao tem `tenant_slug`, e a
guarda do painel confere apenas o papel. Na pratica, qualquer usuario autenticado entra no painel de
qualquer serventia, por qualquer dominio.

Hoje isso nao vaza nada, porque o painel so imprime o nome da serventia. Vira buraco de vazamento
entre serventias na primeira tela de edicao de conteudo, que e a proxima entrega. Consertar agora
custa uma coluna e uma funcao pura; consertar depois custa revisar toda consulta ja escrita.

A decisao de produto e explicita: **o painel e de cada serventia**. Todo usuario pertence a
exatamente uma, sem excecao e sem conta que abre todas.

## What Changes

- **`user.tenant_slug` obrigatorio**, validado contra o registro de serventias. Usuario sem
  serventia deixa de ser representavel.
- **Autorizacao por serventia no nucleo**: `canAccessTenant` como funcao pura em `src/core/auth/`,
  ao lado de `can`. Papel responde o que a pessoa faz; escopo responde onde.
- **Login recusa dominio de outra serventia.** A credencial vale, o acesso naquele dominio nao. A
  resposta e a mesma generica de credencial invalida, e nenhuma sessao sobrevive a recusa.
- **Guarda do painel passa a exigir papel e serventia**, com a verificacao no servidor a cada
  requisicao, como ja acontece com a sessao.
- **Seed passa a exigir a serventia do usuario**, recusando slug que nao existe no registro.
- **Auditoria registra a recusa de acesso**, com ator, serventia tentada e data.
- **BREAKING**: usuarios existentes precisam de serventia. A migracao faz o backfill antes de tornar
  a coluna obrigatoria, e o usuario semeado hoje passa a pertencer a serventia padrao.

## Non-Goals

- Convite ou cadastro de usuarios pelo painel. Usuarios continuam nascendo por seed.
- Acesso da equipe da Atrios a varias serventias. Foi decidido que nao existe: quem precisa entrar
  no painel de uma serventia tem usuario naquela serventia.
- Papeis novos alem de `admin` e `staff`, e permissoes novas alem das que ja existem.
- Troca da serventia de um usuario por interface. Enquanto nao houver painel de usuarios, e
  operacao de banco.
- Qualquer estilo. As telas do painel seguem sem CSS ate a mudanca do design system.
- Isolamento por linha no banco (RLS) ou schema por serventia. O filtro continua na aplicacao.

## Capabilities

### New Capabilities

- `admin-tenant-scope`: vinculo entre usuario do painel e serventia, e a regra de que o acesso ao
  painel exige que a serventia da sessao seja a do usuario.

### Modified Capabilities

<!--
Nenhuma. `openspec/specs/` esta vazio: a mudanca setup-platform-foundation ainda nao foi arquivada,
entao `admin-auth` nao existe como spec principal e nao ha o que versionar como delta.

A capability nova compoe com `admin-auth` em vez de reescreve-la: `admin-auth` responde quem e a
pessoa, `admin-tenant-scope` responde em qual serventia ela pode agir.
-->

## Impact

- **Banco**: coluna `tenant_slug` em `user`, com migracao em tres passos dentro do mesmo arquivo
  (adicionar anulavel, preencher, tornar obrigatoria). Aditiva: um deploy so, sem expand e contract.
- **Nucleo**: `src/core/auth/roles.ts` ganha o escopo por serventia, testado sem banco.
- **Aplicacao**: guarda do painel, acao de login e seed.
- **Configuracao**: `ADMIN_SEED_TENANT` no `.env.example` e no README.
- **Testes**: caso de ponta a ponta afirmando que o usuario de uma serventia nao entra no painel da
  outra, parametrizado sobre o registro como os que ja existem.
- **Sem dependencia nova.**
