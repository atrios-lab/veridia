## Context

`/admin/usuarios` já lista as contas do painel de uma serventia e oferece três ações: criar
conta, reenviar convite, disparar nova senha (`src/app/admin/(dashboard)/usuarios/actions.ts`).
Nenhuma delas revoga acesso. O status "Ativa"/"Aguardando 1º acesso" hoje é derivado — não
existe, e não vai deixar de existir por causa desta mudança — da presença de uma linha em
`account` para o provider `credential` (ver comentário em `page.tsx`). Desativação é um estado
independente disso: uma conta pode ter senha própria e ainda assim estar com o acesso desligado.

O papel Registrador (`admin`) é o único com a permissão `user.manage`, então é o único que pode
gerir contas — é também o único cujo esvaziamento total tranca a serventia para fora da própria
gestão de usuários.

## Goals / Non-Goals

**Goals:**
- Desligar o acesso de uma conta (operador ou registrador) que saiu, sem apagar a conta.
- Reverter isso (reativar) sem exigir nova senha.
- Duas proteções aplicadas no servidor, não só escondendo o botão: própria conta, última conta
  Registrador ativa da serventia.
- Sessões da conta desativada param de funcionar imediatamente, não só no próximo login.

**Non-Goals:**
- Exclusão de conta.
- Desativação em lote ou agendada.
- Expirar acesso automaticamente por inatividade.
- Mudar o papel (Registrador/Operador) como parte de desativar/reativar.

## Decisions

**Coluna nova em vez de reaproveitar `emailVerified`/tabela `account`.** Adiciona-se
`disabledAt: timestamp` (nullable) em `user`. Guarda quando foi desativada — não apenas um
booleano — porque é dado que a auditoria e um eventual "desativada há X dias" na UI já ganham de
graça, sem custar mais que um boolean na modelagem. Alternativa descartada: sobrecarregar a
ausência de linha em `account` (usada para "Aguardando 1º acesso") — misturaria dois estados que
já são independentes na intenção (uma conta pode estar Ativa e desativada ao mesmo tempo).

**Revogar sessão via `db.delete(session)` direto, não via API do Better Auth.** O arquivo já
acessa `user`/`account` via Drizzle diretamente para os dois selects existentes
(`findOwnAccount`). Apagar as linhas de `session` daquele `userId` é o mesmo padrão, mesma
transação de I/O, sem introduzir uma segunda forma de tocar o banco. `getSession()`
(`src/lib/session.ts`) já falha fechado quando a sessão não existe mais — nenhuma mudança
adicional é necessária para o efeito ser imediato no próximo request.

**Bloquear login de conta desativada em `getSession()`, não no `signIn` do Better Auth.**
`getSession()` já é o único ponto que toda rota do painel depende (é o comentário existente no
arquivo: "the single place the office is enforced"). Adicionar `if (session.user.disabledAt)
return null` ali cobre login novo e sessão existente com uma linha, no lugar que já é a
autoridade. Alternativa descartada: hook `before` do Better Auth em `signIn.email` — resolveria
login novo, mas não uma sessão já aberta em outra aba, exigindo de qualquer forma checar de novo
em `getSession()`.

**Última conta Registrador ativa: contagem no servidor, dentro da própria server action.**
`deactivateAccount` conta quantas contas com `role = "admin"` e `disabledAt IS NULL` existem na
serventia (excluindo a conta-alvo da contagem, já que ela está prestes a sair dessa lista); se o
resultado for zero, recusa. Mesma serventia, mesmo filtro de `tenantSlug` que `findOwnAccount`
já usa — nenhuma tabela ou índice novo.

**Reativar não reemite convite nem senha.** A pessoa mantém a senha que já tinha antes de ser
desativada; reativar só limpa `disabledAt`. Emitir novo convite continua sendo o botão "Nova
senha" que já existe, sem duplicar comportamento.

## Risks / Trade-offs

[Um registrador desativa por engano a única outra conta Registrador ativa antes de ela ter
efetivado, gerando corrida] → a contagem e a gravação do `UPDATE` acontecem na mesma query
condicional (`UPDATE ... WHERE role = 'admin' AND disabled_at IS NULL` não se aplica aqui porque
o alvo já é conhecido; a contagem das *outras* contas Registrador ativas é feita antes do
`UPDATE` dentro da mesma invocação da server action) — janela de corrida existente é a mesma que
já existe para qualquer leitura-depois-escrita nesta tela hoje, não introduzida por esta mudança.

[Sessão de outra aba do próprio usuário continua "ativa" até o próximo request] → aceitável:
`getSession()` é chamado em toda navegação do painel, então o próximo clique já falha.

## Migration Plan

Um único deploy: `disabledAt` é aditivo (coluna nova, nullable, sem default divergente de NULL),
não exige o passo expand/contract de duas etapas reservado para migração destrutiva.
