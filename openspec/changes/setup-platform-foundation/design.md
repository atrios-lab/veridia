## Context

Reescrita da plataforma multi-cartorio da Atrios. O sistema anterior (`cartorio-marinho`) esta em
producao com a serventia piloto e permanece intocado. Ele e **referencia de comportamento**: quando
houver duvida sobre uma regra de negocio, consulta-se o que esta em producao. Nao e fonte de copia.
Cada fluxo da Veridia e escrito do zero, deliberadamente, um de cada vez.

O repositorio ja esta scaffoldado como `create-next-app`: Next 16.2.12, React 19.2.4, Tailwind v4,
Biome, pnpm, TypeScript strict, OpenSpec inicializado.

Esta e a fatia de fundacao. O criterio de aceite central e: **dois hosts diferentes devolvem duas
serventias diferentes, sem uma linha de CSS**.

## Goals / Non-Goals

**Goals:**
- Nucleo de dominio puro, testado, sem framework.
- Resolucao por host provada de ponta a ponta com dois tenants deliberadamente diferentes.
- Camada de dados e migracoes com disciplina de mudanca destrutiva.
- Autenticacao com sessao revogavel e admin protegido.
- CI que barra regressao desde o primeiro commit.

**Non-Goals:**
- Design system, tokens de marca, injecao de tema, tipografia, componentes, landing.
- Painel admin de verdade (so o esqueleto protegido, sem estilo).
- Qualquer modulo de negocio.
- Config editavel em banco e painel do cartorio.
- Dominio proprio e emissao de certificado.
- Carga dos valores reais da tabela de custas.

## Decisions

- **App unico, nao monorepo.** A pureza do nucleo nao depende de workspace, depende de fronteira
  verificada. O nucleo vira `src/core/`, com import de `next`, `react` e clientes de banco
  **proibido por regra do Biome** (`noRestrictedImports`). Mesma garantia, sem workspace, sem build
  intermediario e sem ordem de build entre pacotes. Promover para pacote depois e mover pasta.
- **Sem NestJS.** Route Handlers para o que e chamado de fora do browser; Server Actions para
  formularios do admin. O sistema anterior servia o Nest dentro de uma funcao serverless do Next e
  pagava bootstrap do container de DI a cada instancia fria.
- **Drizzle, nao Prisma.** Schema em TypeScript, Zod derivado por `drizzle-zod` (uma pilha de
  validacao so, do formulario ao banco), driver `neon-http` sem pool. Custo assumido: a disciplina de
  migracao passa a ser nossa. Mitigacao na decisao seguinte.
- **`drizzle-kit push` proibido fora de prototipo local.** O fluxo e `generate` -> revisar o SQL ->
  commitar -> `migrate` no deploy. `push` aplica diff direto no banco sem historico, e e assim que se
  perde coluna em producao. Mudanca destrutiva (DROP/RENAME) exige dois deploys: expand, depois
  contract.
- **Better Auth com sessao em banco, nao JWT stateless.** Num sistema com auditoria e LGPD, revogar
  acesso na hora vale mais que economizar um SELECT. NextAuth/Auth.js esta fora: desde setembro de
  2025 e o proprio time do Better Auth que o mantem, em modo de manutencao, e o v5 nao sai do beta.
- **Dois tenants desde o primeiro commit, e o segundo deliberadamente diferente.** Apenas atribuicao
  `NOTAS`, sem editais, sem proclamas. Um segundo tenant parecido com o primeiro nao pega vazamento
  nenhum; o valor esta no contraste. E o que impede a Veridia de repetir o vicio de nascer
  single-tenant.
- **Fatia vertical sem cor antes de qualquer componente.** Uma pagina em HTML pelado que imprime o
  nome da serventia e as secoes habilitadas. Feia de proposito: se tiver estilo, alguem comeca a
  discutir estilo.
- **`node --test` com type stripping, sem Vitest nem Jest.** O nucleo e puro; framework de teste nao
  agrega. Playwright entra para o que `node --test` nao alcanca: multi-tenant de ponta a ponta.
- **Playwright afirma estrutura, nao visual, nesta mudanca.** Quais secoes aparecem por host.
  Snapshot visual entra junto com o design system, quando houver o que fotografar.
- **`check:tokens` entra agora, mesmo sem design system.** Barra hex literal fora do bloco `@theme`.
  Melhor existir no dia em que o primeiro hex aparecer do que ser adicionado depois, com trinta para
  limpar. Mesma logica do `check:dashes`.
- **Codigo em ingles, prosa em portugues.** Identificadores, arquivos, comentarios, commits e nomes
  de teste em ingles, sem hibrido (`themeVars`, nunca `temaVars`). Specs, propostas e texto visivel
  ao usuario em portugues. Siglas oficiais (`RCPN`, `NOTAS`, `RI`, `PROTESTO`, `RTD`, `RCPJ`) e slugs
  de tenant permanecem como estao.
- **Comentario explica o porque, nao o que.** Onde uma regra for contraintuitiva (o ISS que nao
  entra no total, o fallback que precisa falhar alto), o comentario registra o motivo. E o que se
  perde primeiro quando ninguem escreve.

## Risks / Trade-offs

- **Pureza por convencao, nao por fronteira fisica.** `src/core/` depende de regra de lint em vez de
  um pacote separado. Mitigacao: `noRestrictedImports` no Biome, verificado no CI. Se vazar mesmo
  assim, promover a pacote.
- **Migracao manual com Drizzle.** Sem o `migrate dev` do Prisma, o SQL gerado precisa de revisao
  humana no PR. Mitigacao: `push` proibido, SQL commitado, e a regra dos dois deploys documentada.
- **Better Auth possui tabelas no schema.** Acoplamento a evolucao da biblioteca. Mitigacao: a
  autorizacao de negocio (o que cada papel faz) fica em `src/core/`, nunca dentro da lib; a lib
  responde apenas "quem e".
- **Reescrever do zero arrisca perder regra ja conferida em producao.** A composicao de valor do ato
  e o caso mais sensivel: o ISS e deducao da parte da serventia e nao pode ser somado ao total pago
  pelo cidadao. Mitigacao: a regra esta escrita como requisito nesta spec, com cenarios, e o sistema
  anterior fica disponivel para conferencia antes do merge.

## Migration Plan

Greenfield. O sistema anterior continua em producao e nao e tocado. A serventia piloto so migra
quando a Veridia tiver paridade funcional, em mudanca propria e futura.

## Open Questions

- Nome final do segundo tenant fictício e se ele vai ao ar em subdominio de staging ou so em teste.
- Provedor de rate limit (Upstash assumido; `@vercel/firewall` e alternativa) pode ser decidido na
  implementacao sem alterar as specs.
