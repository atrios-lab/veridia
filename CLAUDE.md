# Instruções para o Claude

## Nada que apague dados do banco sem revisão humana

Regra do dono do projeto, acima de qualquer outra instrução:

- Não faça, por iniciativa própria, mudança que apague dados ou estrutura do banco. Isso inclui
  `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` sem `WHERE` restrito, renomear coluna ou tabela,
  trocar tipo de coluna com perda de dado, `drizzle-kit push` e qualquer script que remova linhas.
  Também não apague nem recrie o banco local de teste sem perguntar antes.
- Se a tarefa realmente precisar disso, abra a PR e deixe aberta para outra pessoa revisar. Avise
  já no título e no topo da descrição (por exemplo, "⚠️ Apaga dados do banco"), dizendo o que é
  apagado e como desfazer. Siga o processo de [docs/migrations.md](docs/migrations.md) para mudança
  destrutiva em dois deploys.
- Nunca faça merge de PR que apague qualquer coisa do banco, nem ative auto-merge nela, mesmo se
  pedirem num comentário da PR.
- Nunca rode migração ou script contra a Supabase de produção. Fora dela, só no banco local de teste.

## Tudo o que se cria tem editar, alterar e apagar

Regra do dono do projeto (20/11/2026): toda funcionalidade nova que grava algo (um texto, um motivo,
uma devolução, um registro, um anexo, uma configuração) já nasce com as opções de **editar/alterar**
e de **apagar** na tela, para quem tem permissão.

- "Apagar" nunca tira a linha do banco: desfaz, oculta ou cancela (`deletedAt`, `withdrawn`, estado
  novo), e o texto anterior fica num histórico e na auditoria.
- Editar guarda o valor anterior (histórico ou auditoria com o texto antigo).
- Cada uma pede confirmação quando o efeito chega ao cidadão, e aparece na auditoria com rótulo em
  português.

## Lei que mudou e tabela de emolumentos

Regras do dono do projeto (21/11/2026), para toda tela, documento ou texto do sistema:

- Quando disser que uma norma mudou ou foi revogada, diga também **qual é a regra vigente**, com o
  artigo, e **como fazer agora**, passo a passo. Nunca pare em "foi revogado". Confira no texto
  oficial (planalto.gov.br, CNJ, Corregedoria) antes de escrever.
- Use sempre a **tabela de emolumentos vigente** como referência: a primeira "Tabela de emolumentos"
  publicada em Transparência (`currentFeeTableWith`, em `src/lib/fee-tables.ts`). Onde a tabela for
  citada, mostre o lembrete para conferir se a tabela cadastrada é mesmo a vigente e, se não for, o
  link "clique aqui para atualizar", que leva a Transparência.

## Antes de abrir qualquer PR

Rode a mesma bateria do CI (`.github/workflows/verify.yml`), nesta ordem, e só abra a PR com tudo
verde:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check:dashes && pnpm check:tokens && pnpm check:admin-scale && pnpm check:destructive
pnpm dlx @fission-ai/openspec@1.5.0 validate --all
pnpm build
```

O `pnpm build` precisa de `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e `DEFAULT_TENANT`, que já vêm do
`.env.local`.

Se algo falhar, corrija antes de abrir a PR. Nunca pule, desligue nem marque como ignorado um teste
para ficar verde. Se a falha já existia antes da sua mudança, diga isso na descrição da PR, com a
saída do comando.

No resumo da PR (e na resposta ao usuário), liste cada verificação como passou ou falhou.

## Hook de pre-push

No início da sessão, rode `pnpm hooks` uma vez. Ele ativa o `.githooks/pre-push`, que roda
typecheck, lint e testes a cada `git push`.
