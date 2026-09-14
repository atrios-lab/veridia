## Context

`src/flags.ts` declara `citizenTrackingV2` (Vercel Flags nativo) e expõe `trackingHref()`, o
único ponto que três call sites usam para decidir se a consulta do cidadão vai para `/acompanhar`
ou `/protocolo`:

- `src/app/(public)/layout.tsx` — resolve o link "Consultar protocolo" no cabeçalho, submenu,
  menu do celular e rodapé (via `resolve()` sobre `SECTION_ROUTES["consulta-protocolo"]`).
- `src/app/(public)/page.tsx` — `action` do form de busca de protocolo na hero.
- `src/app/(public)/solicitar/page.tsx` — link "já tenho protocolo" pós-envio de pedido.

`SECTION_ROUTES["consulta-protocolo"]` (`src/core/tenant/gating.ts`) hoje vale `/protocolo` — é
essa constante que a flag "sobrescreve" via `trackingHref()`. O rollout gradual planejado (ligar
por Toolbar, depois Preview, depois Production — changes `feature-flag-acompanhar` e
`migrar-para-vercel-flags`) nunca avançou; sem `FLAGS`/`FLAGS_SECRET` configuradas, a flag sempre
resolveu para `/protocolo`, e é assim que o site se comporta hoje em qualquer ambiente.

`/acompanhar` (`src/app/(public)/acompanhar/page.tsx`) já é gated pela mesma seção
(`consulta-protocolo`, via `requireSection`) e já está pronta em produção — só nunca foi o destino
efetivo por nenhum link do próprio site.

## Goals / Non-Goals

**Goals:**
- `/acompanhar` se torna o único destino que os pontos de entrada do próprio site (cabeçalho,
  rodapé, menu, hero da home, pós-solicitação) resolvem para a seção `consulta-protocolo`.
- Nenhum código, dependência ou variável de ambiente relacionada à flag `citizen-tracking-v2`
  sobrevive à mudança.
- `/protocolo` continua respondendo por acesso direto (sem virar 404, sem redirect forçado):
  compatibilidade com links já publicados ou salvos por cidadãos.

**Non-Goals:**
- Não decide o destino final de `/protocolo` (mantê-la, redirecioná-la ou removê-la) além de
  "continua acessível por URL direta". Isso é uma decisão futura.
- Não muda o conteúdo, layout ou requisitos de `/acompanhar` em si (trilho, chat de exigência,
  Pix) — só quem chega até ela pelos links do site.
- Não introduz nenhuma forma nova de alternância em runtime (flag, config por tenant, env var)
  para essa escolha.

## Decisions

### 1. Apontar `SECTION_ROUTES["consulta-protocolo"]` direto para `/acompanhar`, em vez de manter um helper de resolução

`SECTION_ROUTES` já é a única fonte de verdade para o endereço público de cada seção — é o que
`sectionNavLinks`, `layout.tsx` e a home leem para montar cabeçalho, rodapé, menu e cards. Como a
escolha agora é fixa, o helper `trackingHref()`/`resolve()` (que existia só para desviar dessa
constante em runtime) deixa de ter razão de existir: muda-se o valor da constante
(`/protocolo` → `/acompanhar`) e todo call site que já lê `SECTION_ROUTES["consulta-protocolo"]`
ou `sectionNavLinks("consulta-protocolo")` passa a apontar para `/acompanhar` sem nenhuma mudança
adicional de código.

Alternativa considerada: manter `trackingHref()` como uma função síncrona que sempre retorna
`/acompanhar` (só para não tocar os três call sites). Rejeitada — manteria import e chamada
`await` de uma função que não decide mais nada, código morto disfarçado de decisão.

### 2. `/protocolo` sai de `NAV_GROUPS` (Serviços) e `SECTION_ROUTES["consulta-protocolo"]` passa a valer `/acompanhar`

`NAV_GROUPS` em `layout.tsx` lista `/protocolo` explicitamente entre os hrefs do grupo
"Serviços" — é assim que `pick()` encontra o link da seção `consulta-protocolo` para montar
submenu, rodapé e footer. Como o link dessa seção passa a ter `href: "/acompanhar"`
(via `sectionNavLinks`), a entrada em `NAV_GROUPS` muda de `/protocolo` para `/acompanhar` para
continuar casando. `/protocolo` deixa de aparecer em qualquer menu do site — ela só permanece
alcançável por quem já tem o link salvo ou o digita direto.

### 3. Remover a flag por inteiro, não apenas desligá-la em código

Alternativa considerada: manter `src/flags.ts` e a flag no dashboard da Vercel, só forçando
`defaultValue: true` e nunca mais lendo `request` — "desligar" sem remover. Rejeitada: mantém a
dependência de produção (`flags`, `@flags-sdk/vercel`), o endpoint de discovery, as variáveis de
ambiente e o teste dedicado, tudo para uma decisão que não é mais dinâmica. Combina melhor com o
princípio do projeto de não manter feature flags para decisões já tomadas — remove-se por
completo: arquivo, dependências, endpoint, variáveis de ambiente, seção do README e teste.

### 4. Changes OpenSpec `feature-flag-acompanhar` e `migrar-para-vercel-flags` não são arquivadas — são removidas

Ambas têm tarefas de rollout pendentes (`[ ]`) que descreviam um plano (ligar a flag
gradualmente) que esta mudança torna sem sentido: não existe mais flag para ligar. Arquivá-las
tentaria sincronizar a capability `citizen-tracking-rollout` (que descreve o comportamento da
flag) para `openspec/specs/`, o que contradiz a própria mudança. A capability nunca chegou a
`openspec/specs/` (nenhuma das duas changes foi arquivada), então não há delta a desfazer nos
specs principais — as duas pastas de change são apenas apagadas de
`openspec/changes/`.

## Risks / Trade-offs

- **[Risco] Links externos ou favoritos apontando para `/protocolo` continuam funcionando, mas o
  cidadão não vê mais o caminho pelo menu** → Mitigação: `/protocolo` continua respondendo
  normalmente (não é removida nem redirecionada); só some da navegação do site, que é o
  comportamento pedido.
- **[Risco] Algum teste in-process (`src/flags.test.ts`) ou de navegação assume `/protocolo` como
  destino padrão** → Mitigação: `flags.test.ts` é removido junto com o arquivo que testa; testes
  de navegação/gating existentes precisam ser conferidos e atualizados para esperar
  `/acompanhar`.
- **[Risco] Remover as changes `feature-flag-acompanhar`/`migrar-para-vercel-flags` apaga o
  histórico de decisões nelas registrado** → Mitigação: a razão de existirem (rollout controlado)
  fica registrada nesta proposta e no `git log`; não há necessidade de manter pastas de change
  para um plano abandonado.

## Migration Plan

1. Atualizar `SECTION_ROUTES["consulta-protocolo"]` e `NAV_GROUPS` (`src/core/tenant/gating.ts`,
   `layout.tsx`) para `/acompanhar`.
2. Remover os três call sites de `trackingHref()`/`lookupHref` assíncrono, usando a constante
   diretamente.
3. Remover `src/flags.ts`, `src/flags.test.ts`,
   `src/app/.well-known/vercel/flags/route.ts`.
4. Remover dependências `flags` e `@flags-sdk/vercel` do `package.json` e rodar o gerenciador de
   pacotes para atualizar o lockfile.
5. Atualizar `.env.example` e README.
6. Remover `openspec/changes/feature-flag-acompanhar/` e
   `openspec/changes/migrar-para-vercel-flags/`.
7. Rodar typecheck, lint e testes in-process; conferir manualmente cabeçalho, rodapé, menu e home
   apontando para `/acompanhar`, e `/protocolo` ainda respondendo por acesso direto.

Rollback: reverter o commit. Não há estado de infraestrutura (Edge Config, Vercel Flags) que
precise ser desfeito no código — a flag em si pode continuar existindo no dashboard da Vercel sem
efeito, e pode ser apagada por lá quando conveniente (fora do escopo desta mudança).

## Open Questions

- Quando remover `/protocolo` por completo (ou torná-la um redirect para `/acompanhar`)? Fica
  registrado como trabalho futuro, fora do escopo desta mudança.
