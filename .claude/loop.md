# Loop de qualidade de front-end

## Objetivo (verificável)

- Zero erros de console nas rotas principais.
- `pnpm lint` limpo.
- `pnpm test` passando.
- `pnpm check:a11y` sem violações critical/serious (axe).

Aplicação: `pnpm dev` em `http://localhost:3000`
(use `http://marinho.localhost:3000` para ver o tenant real).

## Execução de uma iteração

1. Leia `.claude/loop-state.md` para saber onde parou.
2. Delegue ao `ux-reviewer` a inspeção da aplicação rodando.
3. BUGS -> delegue ao `frontend-fixer`, um por vez.
4. PROPOSTAS DE UX -> não implemente; acrescente em `UX_PROPOSALS.md`
   (tela, problema, sugestão, esforço estimado), sem duplicar itens.

## Verificação

Após cada correção rode `pnpm lint`, `pnpm test` e `pnpm check:a11y`; confirme o console limpo com
uma nova leitura do navegador. Quem verifica não é quem corrigiu: a verificação
volta para o `ux-reviewer` (ou para o loop), nunca para o `frontend-fixer` que
aplicou a mudança.

## Regra de parada (estados terminais)

- **SUCESSO**: objetivo atingido e 2 iterações seguidas sem achado novo.
- **ESTAGNADO**: 2 iterações sem progresso no mesmo bug.
- **ESGOTADO**: teto de 15 iterações.
- **BLOQUEADO**: precisa de decisão minha — registre a pergunta e pare.

Erro nunca conta como sucesso.

## Memória

Ao fim de CADA iteração atualize `.claude/loop-state.md` com: iteração atual,
o que foi corrigido, o que ficou pendente e o estado.
