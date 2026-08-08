# Design: Redesign — Home e Solicitar serviço

## Context

A fundação existe: resolução de tenant por host (`src/lib/tenant.ts`), gating de seções
(`src/core/tenant/gating.ts`), catálogo semente de atos (`src/core/acts/catalog.ts`), admin com
Better Auth, rate limit Upstash, auditoria (`src/lib/audit.ts`) e tabelas `tenant_branding` /
`tenant_content` / `audit_log`. Não há nenhum CSS: `layout.tsx` não importa stylesheet e o
Tailwind (v4, `@tailwindcss/postcss`) está instalado mas nunca foi usado.

Referências vinculantes:

- **Design**: projeto Claude Design `558c4556-caed-4f30-9c6b-648f995805cf`, arquivo
  `Redesign 01 - Home e Solicitar.dc.html` (seção `#turno-1` = telas; `#turno-2` = prova de
  que o tema é configuração do tenant: 5 paletas, mesma estrutura). Cópia decodificada para
  consulta durante a implementação: buscar via `DesignSync get_file` quando necessário.
- **Comportamento**: `cartorio-marinho/temp/historias-de-usuario-e-fluxos.md` seções 1, 2 e
  observações transversais. O código do sistema anterior é referência de regra
  (`apps/api/src/pedidos/*`, `packages/tenants/src/atos.ts`), nunca fonte de cópia.

## Goals / Non-Goals

**Goals:**

- Home e wizard Solicitar idênticos ao design, mobile-first, tematizados por configuração.
- Pedido persistido com protocolo sequencial por tenant, chave de acesso mostrada uma vez,
  anexos e requerimento em PDF — regra de negócio em `src/core`, sem framework.
- Jornada completa verificável por Playwright em viewport mobile.

**Non-Goals:** os da proposta (consulta, agendar/LGPD/ouvidoria, chat, admin de pedidos,
pagamentos, banner de cookies, editor de tema no admin).

## Decisions

### 1. Tema: tokens no tenant config → CSS variables → `@theme inline`

**Ajustado na implementação.** O plano original era pôr a paleta (hexes) no config do tenant.
O guardrail `scripts/check-tokens.mjs` do repositório proíbe hexadecimal em qualquer lugar de
`src/**` fora do bloco `@theme` — inclusive nos configs de tenant. Manter o guardrail é melhor
que abrir exceção para ele, então o desenho final é:

- `TenantSchema` ganha `theme`: enum dos 5 temas do Turno 2 (`verde-dourado`, `marinho-bronze`,
  `vinho-perola`, `grafite-cobre`, `oliva-terracota`), mais `heroImage` opcional.
- `globals.css` concentra os hexes num `@theme static` (as 5 paletas cruas) e mapeia cada tema
  para os tokens semânticos em blocos `[data-theme="..."]`, com `@theme inline` expondo
  `--color-brand-*` às utilities. Cadastrar serventia é escolher um tema, nunca escrever CSS.
- O layout público põe `data-theme` num wrapper (não no `<html>`), que é o que mantém o admin
  fora do tema do tenant.

- Alternativa rejeitada: CSS por tenant em build (um arquivo por serventia) — quebra o
  princípio de deploy único e explode com N tenants.
- Fontes: `next/font/google` só carrega a serifada do tenant resolvido + Public Sans (fixa).
  As 5 instâncias declaram a mesma variável (`--font-brand-serif`) e o layout aplica só a
  className do tema escolhido. `next/font` exige opções literais (nada de spread nem de
  variável), então as 5 chamadas ficam escritas por extenso.
- `marinho` recebe o tema Verde & Dourado (2a do design); `aurora` recebe Marinho & Bronze
  (2b) para provar no dev que o tema varia por host sem mudança de código.

### 2. Shell público como layout de rota group `(public)`

`src/app/(public)/layout.tsx` com header e footer; a home e `/solicitar` movem para o group.
Navegação e cartões renderizam apenas seções habilitadas (`enabledSections`) — o design já
prevê "qualquer subconjunto de seções" (grade auto-fit, chips dinâmicos). Admin fica fora do
group e sem tema de tenant (estética da plataforma, regra existente).

Três coisas apareceram ao montar o shell:

- **Rotas por seção.** Os valores de `Section` são chaves de gating, não URLs: as rotas que os
  cidadãos já conhecem são `/solicitar`, `/protocolo`, `/lgpd`, `/selo`, `/centrais`. Entram
  `SECTION_ROUTES` e `SECTION_LABELS` em `gating.ts`, ambos `Record<Section, string>`, para
  seção nova não subir sem endereço nem rótulo.
- **Seção `agendamento`.** O design põe "Agendar atendimento" entre as três ações principais e
  as histórias de usuário têm `/agendar`, mas não havia seção correspondente. Entra como
  `"always"` (toda serventia tem balcão). O formulário em si é da Entrega 3.
- **Stubs para o que ainda não existe.** Navegação fiel ao gating não pode apontar para rota
  inexistente. As seções cujas telas vêm nas Entregas 2 a 4 ganham uma página `ComingSoon`
  (título, aviso e canais de contato do tenant), com o mesmo `requireSection` no servidor.
  `/editais` já lista os setores da serventia e `/lgpd` já publica o encarregado, que é
  exigência do art. 41 da LGPD e não depende do formulário.

### 3. Catálogo de atos: dado completo no núcleo, `processingMode` derivado do tipo

`Act` ganha `processingMode: "identification" | "online" | "presential"` (equivalente ao
`tipo` do sistema anterior: `motivacao`/`requerimento`/`presencial`), `documents?: string[]`,
`guidance?: string`, `parameter?: "transactionValue" | "registryYears"`,
`requiresDescription?: boolean`. Os selos do design mapeiam 1:1: identification → "Só
identificação", online → "100% on-line", presential → "On-line + presencial". Exemplos por
atribuição (`ATTRIBUTION_EXAMPLES`) viram constante ao lado de `ATTRIBUTION_NAMES`. O dado é
reescrito conferindo cada ato contra `atos.ts` do sistema anterior (base legal incluída).
Contagem "N atos" da etapa 1 é `actsOfAttribution(...).length` — nada hardcoded.

### 4. Pedido: núcleo puro + Server Action fina

- `src/core/request/`: geração de protocolo (`REQ.` + ano + sequência com 6 dígitos),
  geração e verificação de chave (`XXXX-XXXX-XXXX`, alfabeto sem ambíguos, armazenada como
  SHA-256 — o texto claro aparece uma única vez na resposta), validação Zod do formulário
  (aceites obrigatórios, finalidade quando `requiresPurpose`, descrição quando
  `requiresDescription`, honeypot `website` vazio). Tudo testado com `node --test`.
- Tabelas Drizzle: `service_requests` (tenantSlug, protocolNumber único por tenant, actId,
  applicant, contato, cpf opcional, description, purpose, accessKeyHash, status inicial
  `new`, timestamps) e `service_request_attachments` (requestId, storedName, displayName
  posicional `anexo-N`, mimeType, size, kind `citizen|signed-form`). Migração expand-only.
- Sequência do protocolo: lê `max(seq)` por (tenant, ano) e insere; o unique index
  (tenant, ano, seq) é o que resolve a corrida, com retry no conflito. Sem tabela de contador
  dedicada e sem transação interativa (o driver neon-http não tem).
  **Achado na implementação:** o Drizzle embrulha o erro do driver, então o SQLSTATE `23505`
  fica na cadeia de `cause`, não no erro capturado. Ler só o topo transformava o retry em
  "não foi possível enviar o pedido" sempre que dois pedidos chegavam juntos. `isPostgresError`
  (`src/db/errors.ts`) percorre a cadeia e tem teste próprio.
- Server Action recebe `FormData` (arquivos incluídos), valida no núcleo, aplica rate limit
  (lib existente), grava, audita (`audit_log`), retorna protocolo + chave em claro uma vez.
  Honeypot preenchido → resposta de sucesso falsa sem gravação (comportamento do sistema
  anterior: sem atrito, sem dica ao robô).

### 5. Anexos: Vercel Blob em produção, disco em dev

Mesmo modelo do sistema anterior: valida tipo (imagem/PDF) e tamanho no servidor, nome
armazenado derivado do mimetype (nunca do nome do cliente), `@vercel/blob` quando
`BLOB_READ_WRITE_TOKEN` existe, senão `UPLOAD_DIR` local. URL do blob nunca exposta ao
cidadão; a entrega ao cidadão é assunto da Entrega 2 (consulta).

### 6. PDF do requerimento: pdfkit em Route Handler

`pdfkit` (mesma lib do sistema anterior, roda no runtime Node da Vercel) gera o requerimento
pré-preenchido: identificação da serventia, ato, dados do solicitante, descrição, aceites,
protocolo e chave impressos. O conteúdo do PDF (texto e estrutura) monta em função pura no
núcleo; o pdfkit só desenha.

**Corrigido do plano original:** a rota é `POST /solicitar/requerimento` com protocolo e chave
no corpo, não `GET` com eles na query. Chave em query string entra na barra de endereço, no
histórico do navegador e em todo log do caminho — o oposto do que ela protege. Botão continua
sendo um clique (form POST). Sem chave válida, 404 (mesma resposta de protocolo inexistente,
para não confirmar a existência de um protocolo a quem chuta números). `serverExternalPackages:
["pdfkit"]` no `next.config.ts`, senão o bundler reescreve os caminhos das métricas de fonte.

### 7. Wizard: estado na URL, sem estado global

`/solicitar?atribuicao=RCPN&ato=rcpn-habilitacao-casamento` — Server Component decide a etapa
pelo que já foi escolhido; voltar/trocar são links. Só o formulário da etapa 3 é Client
Component (anexos, máscara, submit da action). Checklist de documentos é informativo
(design: orienta, não bloqueia). Sucesso renderiza da resposta da action (chave em claro
existe só nesse render; recarregar a página não a mostra de novo).

### 8. Stub `/protocolo`

O campo da hero submete via GET para `/protocolo` (Entrega 2). Stub mínimo: página que
confirma o número recebido e informa que a consulta on-line está em construção, com os
contatos do tenant. Evita link morto sem antecipar a Entrega 2.

### 9. Asset `hero-home.jpg`

**Resolvido pelo repositório do sistema anterior.** O export via `DesignSync get_file` passa do
limite de 256 KiB e volta truncado; a mesma foto existe íntegra no sistema anterior
(`apps/web/public/tenants/cartorio-marinho/hero-home.jpg`, 2000x1333) e foi copiada para
`public/hero-home.jpg`, com `heroImage` apontado no config do marinho. Asset binário não é
código: a regra de nunca copiar do sistema anterior não se aplica à fotografia oficial da
serventia. Tenant sem `heroImage` continua caindo no gradiente.

## Risks / Trade-offs

- [Corrida na sequência do protocolo] → unique index (tenant, ano, seq) + retry; volume de um
  cartório municipal torna conflito raríssimo.
- [Chave vista uma única vez e perdida] → previsto no produto (admin reemite na Entrega 6);
  o PDF do requerimento também carrega a chave, como no design.
- [5 fontes Google declaradas mas 1 usada] → `next/font` só faz download/subset das usadas
  no HTML renderizado; custo real ~zero.
- [pdfkit + fontes serifadas no PDF] → PDF usa fontes padrão do pdfkit (Times/Helvetica);
  fidelidade tipográfica do PDF não é requisito, legibilidade é.
- [Blob público com URL aleatória] → mesmo trade-off consciente do sistema anterior
  (`ponytail:` anotado); URL nunca sai do servidor. Migrar para URL assinada se sigilo forte
  virar requisito.
- [Design tem chat flutuante e cookies nas histórias] → fora do escopo declarado; sem cookie
  não essencial não há obrigação de banner.

## Migration Plan

Uma migração Drizzle expand-only (tabelas novas). Deploy único; rollback = reverter o deploy
(tabelas novas ficam órfãs, sem dano). Nenhum dado existente é tocado.

## Open Questions

- Copy institucional final ("Quem somos", frase da hero) — usar o texto do design como
  conteúdo inicial do tenant config; o registrador ajusta depois via `tenant_content`
  (Entrega 9).
