## Context

"Nunca acessou" já é um estado derivado na tela: `listAccounts` (`usuarios/page.tsx`) faz
`leftJoin` em `account` pelo provider `credential` e chama a conta de `active` quando existe uma
linha. Uma linha em `account` só nasce quando a pessoa cria a própria senha em
`/admin/redefinir-senha`. Logo, "sem credencial" é exatamente "nunca entrou no painel" — e quem
nunca entrou nunca praticou ato nenhum.

O grafo de exclusão no banco já está quase todo resolvido:

- `session.userId` e `account.userId` são `onDelete: "cascade"` (`src/db/auth-schema.ts`).
- `auditLog.actorId` é `text` sem chave estrangeira, deliberadamente ("a trilha que tem que
  sobreviver a uma auditoria", `src/db/schema.ts`).
- Todo `authorUserId` (mensagens de exigência, conversas e mensagens de chat) é
  `onDelete: "set null"`.
- `verification` não referencia `user`: o token de convite é uma linha com
  `identifier = "reset-password:<token>"` e `value = <userId>`, sem FK.

Ou seja: apagar a linha de `user` não estoura nenhuma restrição. O que sobra é a linha de
`verification` do convite que a conta recebeu e nunca usou.

## Goals / Non-Goals

**Goals:**
- Remover da lista uma conta criada por engano e liberar o e-mail dela para um novo convite.
- Manter intacta a atribuição de atos de qualquer conta que já trabalhou no painel.
- Não deixar token órfão para trás.
- Acomodar as ações destrutivas da linha no menu "…" do front entregue.

**Non-Goals:**
- Excluir conta com histórico.
- Anonimizar atos já praticados.
- Retenção automática (expirar convite não aceito).

## Decisions

**A elegibilidade é "sem credencial", não uma coluna nova.** Excluir é oferecido quando a conta
não tem linha em `account` para o provider `credential` — a mesma condição que já pinta o selo
"Aguardando 1º acesso". Sem coluna nova, sem migração, e a regra que o operador lê na tela é a
mesma que o servidor aplica. Alternativa descartada: contar linhas de `audit_log` com aquele
`actorId` para decidir. Parece mais preciso, mas é a pergunta errada: uma conta pode ter entrado
no painel, lido tudo e não ter gravado nenhuma auditoria, e ainda assim é uma pessoa que teve
acesso — além de custar uma query a mais para chegar num critério mais frouxo.

**A checagem de elegibilidade é refeita no servidor, dentro da mesma operação.** `findOwnAccount`
hoje não traz a credencial; a action passa a resolver o alvo com a informação de credencial
junto e recusa se houver. Esconder o item do menu é cortesia, não controle de acesso — o servidor
recusa mesmo que a submissão venha forjada.

**A proteção do último Registrador não precisa ser repetida aqui.** Excluir só alcança conta sem
credencial, e uma conta sem credencial nunca esteve logada. Quem executa a exclusão está logado,
logo tem credencial, logo nunca é o próprio alvo; e se o alvo é um Registrador que nunca acessou,
o Registrador que está clicando já é outro Registrador ativo — a serventia nunca fica sem. A
regra vale por construção, e escrever a checagem de novo seria código que não tem como ser
executado. O raciocínio fica registrado aqui porque o que não é óbvio é *por que* a guarda está
ausente.

**Apagar o token de convite explicitamente, reusando o predicado que já existe.**
`issueResetTokenWith` já apaga os tokens anteriores de um usuário com um `deleteMany` por
`value = userId` e `identifier starts_with "reset-password:"` (`src/lib/auth-tokens.ts`). A
exclusão usa o mesmo predicado. Não é falha de segurança deixar para trás — o fluxo de
`acceptInvite` lê a linha de `verification`, busca o `user` correspondente e já redireciona para
a tela de link expirado quando não encontra (`redefinir-senha/actions.ts`) —, mas uma linha
válida por 48h apontando para um usuário inexistente é lixo que ninguém vai lembrar de explicar
depois.

**Ordem: token primeiro, depois o `user`.** Se a segunda operação falhar, sobra uma conta sem
convite em aberto, que é recuperável pelo botão "Reenviar convite". Na ordem inversa, uma falha
deixaria o token órfão que a decisão acima quer evitar. Sem transação explícita: são duas
operações, o pior caso da ordem escolhida é benigno, e o arquivo não abre transação em nenhuma
outra action.

**Confirmação curta, sem digitar o e-mail.** O front entregue previa dois diálogos: um curto
para conta que nunca acessou e um forte, com digitação do e-mail, para conta ativa. Como a
segunda operação deixa de existir, sobra só o curto: pergunta, a frase "Ela nunca foi acessada",
Excluir / Cancelar. Usa o `ConfirmAction` que já existe, sem componente novo.

**O menu "…" entra agora porque agora tem dois itens.** Era o motivo declarado para adiá-lo em
`atualizar-conta-do-painel`. "Desativar acesso" sai de botão visível e vira item do menu, junto
com "Excluir conta"; "Atualizar" e a ação de convite/senha continuam fora. O menu precisa
funcionar por teclado e fechar ao pressionar Escape ou clicar fora — mesmas exigências de
`AdminDialog`.

**Nada de exclusão lógica com prazo.** Um `deletedAt` daria arrependimento, mas não resolve o
problema que motiva a change: o e-mail continuaria ocupado pelo índice único, que é a metade cara
do estrago. Exclusão é definitiva e o diálogo diz isso.

## Risks / Trade-offs

- **Exclusão é irreversível e não há lixeira** → Mitigada pelo escopo: o que se perde é uma linha
  com nome, e-mail e papel, de uma conta que nunca foi usada. Recriar é o mesmo formulário de
  "Criar conta", com o mesmo esforço do convite original.
- **A elegibilidade pode mudar entre a tela e o clique** (a pessoa aceita o convite enquanto o
  registrador tem o diálogo aberto) → A checagem no servidor roda no momento da submissão e
  recusa; a tela recarrega mostrando a conta já como "Ativa".
- **O e-mail liberado pode ser reconvidado em outra serventia** → É o comportamento desejado, e é
  o que estava bloqueado antes. A auditoria da serventia antiga guarda `user.delete` com o
  `targetId`, então a exclusão em si fica registrada.
- **`audit_log` passa a ter `targetId` apontando para uma conta inexistente** (as linhas de
  `user.invite` daquela conta) → Aceito: `actorId`/`targetId` são `text` sem FK exatamente para
  que a trilha sobreviva ao que ela descreve, e nenhuma tela hoje resolve `targetId` de eventos
  de conta.
