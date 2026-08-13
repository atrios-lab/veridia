## Why

A tela `/admin/usuarios` cria contas, reenvia convite e dispara nova senha, mas não existe
nenhuma ação para desligar o acesso de um operador ou registrador que saiu da serventia — a
conta continua "Ativa" e a senha continua valendo indefinidamente. Também não há nenhuma
proteção contra os dois jeitos óbvios de o registrador se trancar para fora: desativar a
própria conta, ou desativar a última conta com papel Registrador da serventia, o que deixaria
o escritório sem ninguém com `user.manage` para reverter.

## What Changes

- Nova ação "Desativar acesso" em cada linha de conta (exceto onde as proteções abaixo se
  aplicam): marca a conta como desativada, encerra toda sessão ativa dela imediatamente e
  bloqueia login enquanto durar.
- Nova ação "Reativar acesso" para uma conta desativada, que devolve o acesso sem exigir nova
  senha (a senha existente continua valendo).
- Novo selo de status "Acesso desativado" na lista, distinto de "Ativa" e "Aguardando 1º
  acesso".
- Proteção: a conta da própria sessão nunca oferece "Desativar acesso" (nem no servidor, nem na
  UI).
- Proteção: desativar é recusado, no servidor, se a conta-alvo for a última conta com papel
  Registrador ainda ativa na serventia.
- Auditoria: cada desativação e reativação grava uma entrada em `recordAudit`, como as demais
  ações da tela.

**Não-objetivos**: não há exclusão de conta (a conta desativada continua listada, só perde
acesso); não há desativação em massa; não há prazo automático de desativação por inatividade;
o papel (Registrador/Operador) da conta não muda ao desativar.

## Capabilities

### New Capabilities

(nenhuma — a tela e as ações de conta já existem)

### Modified Capabilities

- `admin-users`: adiciona as ações Desativar acesso / Reativar acesso, o selo "Acesso
  desativado", o bloqueio de login para conta desativada, e as duas proteções (própria conta,
  última conta Registrador ativa).

## Impact

- `src/db/auth-schema.ts`: nova coluna nullable em `user` (ex.: `disabledAt timestamp`) —
  migração aditiva, sem passo destrutivo.
- `src/app/admin/(dashboard)/usuarios/actions.ts`: novas server actions `deactivateAccount` /
  `reactivateAccount`, com as duas checagens de proteção antes de gravar.
- `src/app/admin/(dashboard)/usuarios/account-row-actions.tsx` e `page.tsx`: novo botão, novo
  selo de status, e ocultar/desabilitar "Desativar acesso" na própria linha da sessão.
- `src/lib/session.ts` (ou o login do Better Auth): recusar sessão/login de conta desativada.
- `src/lib/audit.ts`: dois novos valores de `action` (`user.deactivate`, `user.reactivate`).
