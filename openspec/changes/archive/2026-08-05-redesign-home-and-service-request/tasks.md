# Tasks: Redesign — Home e Solicitar serviço

Referência visual: projeto Claude Design `558c4556-caed-4f30-9c6b-648f995805cf`, arquivo
`Redesign 01 - Home e Solicitar.dc.html` (buscar via `DesignSync get_file`; seção `#turno-1`).
Referência de comportamento: `cartorio-marinho/temp/historias-de-usuario-e-fluxos.md` seções
1–2. Cada fluxo é escrito do zero; o sistema anterior confere regra, nunca fornece código.

## 1. Fundação visual (public-site-foundation)

- [x] 1.1 Adicionar `brand` ao `TenantSchema` (paleta + `serifFont` enum das 5 famílias) e
      configurar `marinho` com Verde & Dourado (2a) e `aurora` com Marinho & Bronze (2b),
      com teste do parse em `tenant.test.ts`
- [x] 1.2 Criar `src/app/globals.css` com Tailwind v4 e `@theme inline` mapeando tokens de
      marca para CSS variables do tenant; importar no `layout.tsx`
- [x] 1.3 No `layout.tsx`, injetar as CSS variables do tenant resolvido e as 5 fontes via
      `next/font/google` (aplicando só a serifada do tenant + Public Sans)
- [x] 1.4 `hero-home.jpg` em `public/` e `heroImage` apontado no config do marinho. O export
      via DesignSync excede 256 KiB e volta truncado; a foto veio do repositório do sistema
      anterior (`apps/web/public/tenants/cartorio-marinho/hero-home.jpg`), mesmo arquivo usado
      no projeto de design.
- [x] 1.5 Criar route group `src/app/(public)/` com layout: cabeçalho (selo, nome, subtítulo,
      nav gated por `enabledSections`, menu mobile) e rodapé (nav secundária + `legalFooter`)

## 2. Home (public-home)

- [x] 2.1 Reescrever a home no group `(public)`: hero com imagem + overlay, campo único de
      protocolo (form GET para `/protocolo`), texto de apoio REQ/AGD/SOL/ouvidoria
- [x] 2.2 Cartões de ação (Solicitar, Agendar com `openingHours`, Selo), chips de atribuições
      e blocos "Cidadão e transparência" / "Quem somos" — tudo derivado do tenant e gated
- [x] 2.3 Versão desktop (nav no topo, hero horizontal, grade auto-fit) conforme o design
- [x] 2.4 Stub `/protocolo`: exibe protocolo recebido, aviso de construção e contatos do tenant

## 3. Catálogo de atos (service-request)

- [x] 3.1 Expandir `Act` (`processingMode`, `documents`, `guidance`, `parameter`,
      `requiresDescription`) e portar o catálogo completo das 6 atribuições, conferindo cada
      ato e base legal contra `packages/tenants/src/atos.ts` do sistema anterior
- [x] 3.2 Adicionar `ATTRIBUTION_EXAMPLES` (exemplos do dia a dia por atribuição) e labels
      dos selos de tramitação; atualizar `catalog.test.ts` (filtro por tenant, contagens,
      finalidade proibida em certidões)

## 4. Núcleo e banco do pedido (service-request)

- [x] 4.1 `src/core/request/`: geração de protocolo `REQ.AAAA.NNNNNN`, chave `XXXX-XXXX-XXXX`
      (alfabeto sem ambíguos) + hash SHA-256 e verificação, validação Zod do formulário
      (aceites, finalidade condicional, descrição condicional, honeypot) — com `node --test`
- [x] 4.2 Tabelas Drizzle `service_requests` e `service_request_attachments` + unique index
      (tenant, ano, seq) e migração expand-only
- [x] 4.3 Inserção com sequência por (tenant, ano) em transação com retry em conflito, e
      registro em `audit_log`

## 5. Wizard /solicitar (service-request)

- [x] 5.1 Etapas 1 e 2 como Server Components com estado na URL: cards de atribuição com
      exemplos e contagem real de atos; lista de atos com selos e explicação dos modos;
      "trocar" em ambas
- [x] 5.2 Etapa 3: contexto do ato fixo no topo (com "trocar"), formulário Client Component
      (campos, checklist informativo de documentos, anexos até 5 com validação client de
      conveniência, aceites, honeypot invisível)
- [x] 5.3 Server Action: rate limit, validação do núcleo, armazenamento de anexos
      (`@vercel/blob` com fallback `UPLOAD_DIR`, nome derivado do mimetype, validação
      servidor), gravação, honeypot → sucesso falso
- [x] 5.4 Tela de sucesso renderizada da resposta da action: chave em destaque com aviso
      "aparece só agora", botões copiar, 3 passos numerados, anexar assinado (action que
      adiciona anexo `signed-form`), atalhos Acompanhar/Novo pedido
- [x] 5.5 Versão desktop das etapas (grid 2 colunas com lateral "Como funciona" / contexto
      do ato) conforme o design

## 6. PDF do requerimento (service-request)

- [x] 6.1 Montagem pura do conteúdo do requerimento no núcleo (serventia, ato, solicitante,
      descrição, aceites, protocolo, chave) com teste
- [x] 6.2 Route Handler `GET` do PDF com pdfkit, exigindo chave válida (hash) — 404 sem ela;
      botão "Baixar requerimento (PDF)" na tela de sucesso

## 7. Verificação

- [x] 7.1 E2E Playwright mobile (390px): home → solicitar → 3 etapas → sucesso com protocolo
      e chave visíveis → baixar PDF → anexar assinado; e caso honeypot sem gravação
- [x] 7.2 Conferir os dois tenants no dev (marinho verde/dourado, aurora marinho/bronze):
      mesma estrutura, marcas distintas; `pnpm biome check`, `node --test`, build limpo
