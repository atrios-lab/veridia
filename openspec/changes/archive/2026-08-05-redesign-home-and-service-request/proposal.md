# Proposta: Redesign — Home e Solicitar serviço (Entrega 1 de 9)

## Why

A plataforma tem a fundação multi-tenant pronta (resolução de tenant, gating, admin com login),
mas o site público ainda é HTML sem estilo e sem os fluxos do cidadão. O redesign aprovado no
Claude Design ("Redesign 01 - Home e Solicitar", projeto `558c4556-caed-4f30-9c6b-648f995805cf`)
define a primeira entrega: home mobile-first com ação na primeira dobra e o wizard de solicitação
de serviço em 3 etapas — o fluxo de maior volume do cartório. As histórias de usuário levantadas
do sistema anterior (`cartorio-marinho/temp/historias-de-usuario-e-fluxos.md`, seções 1 e 2)
são o critério de comportamento.

## What Changes

- Nasce a camada visual do site público: Tailwind v4 CSS-first com `@theme`, estrutura fixa e
  marca (cores + fonte serifada) vinda da configuração do tenant — nenhum hex fora do tema,
  conforme o "Turno 2" do design (mesmo fluxo, 5 temas por configuração).
- Shell do site público: cabeçalho (selo, nome, navegação com gating por seção), rodapé com
  navegação e texto legal, responsivo mobile-first.
- Home (`/`) conforme o design: hero com identidade da serventia e campo único de consulta de
  protocolo na primeira dobra, cartões de ação (Solicitar, Agendar, Selo), chips de atribuições,
  bloco "Cidadão e transparência", "Quem somos" e rodapé.
- Catálogo de atos completo no núcleo (hoje é semente de 1 ato por atribuição): atos com selo de
  tramitação em linguagem direta ("Só identificação", "100% on-line", "On-line + presencial"),
  documentos esperados, exemplos por atribuição. Fonte de conferência: sistema anterior
  (`packages/tenants/src/atos.ts`), reescrito, nunca copiado.
- Wizard `/solicitar` em 3 etapas (Atribuição → Ato → Pedido): cards de atribuição com exemplos
  do dia a dia, atos com selo de expectativa, formulário com ato fixo no topo, checklist de
  documentos, anexos (até 5, imagem/PDF), aceites LGPD e de veracidade, honeypot invisível.
- Persistência do pedido: tabela de pedidos de serviço com protocolo `REQ.AAAA.NNNNNN`
  (sequência por tenant/ano) e chave de acesso exibida uma única vez (armazenada com hash).
- Tela de sucesso: chave em destaque máximo com aviso "aparece só agora", botões copiar,
  requerimento em PDF pré-preenchido para baixar e assinar (Gov.br ou punho), envio do
  assinado ali mesmo ou depois.
- Assets da marca no repositório: `hero-home.jpg` exportado do projeto de design (logos já
  existem em `public/logos`).

## Não-objetivos

- Consulta de protocolo (`/protocolo`) e detalhe do pedido — Entrega 2. O campo da hero navega
  para a rota, que fica como stub mínimo até lá.
- Agendar, LGPD, ouvidoria, páginas informativas, chat (widget e fila) — Entregas 3, 4 e 8.
  O botão flutuante de atendimento não entra nesta entrega.
- Painel admin de pedidos (fila, detalhe, exigências, valores, entrega) — Entrega 6. O pedido
  criado aqui só precisa existir no banco, auditado.
- Pagamentos, cálculo de emolumentos e decomposição de valores.
- Banner de cookies: o site público desta entrega não usa cookie não essencial; sem cookie,
  banner é ruído. Entra quando (se) houver rastreamento.
- Editor de tema no admin (`tenant_branding` overrides) — o tema desta entrega vem da
  configuração em código do tenant.

## Capabilities

### New Capabilities

- `public-site-foundation`: tema por tenant (tokens de cor + serifada via `@theme`/CSS vars,
  estrutura fixa) e shell do site público (cabeçalho, rodapé, navegação com gating por seção).
- `public-home`: home institucional com ação na primeira dobra — campo único de protocolo,
  cartões de ação, atribuições, blocos cidadão/transparência e quem somos.
- `service-request`: catálogo de atos completo com selos de tramitação e documentos; wizard de
  solicitação em 3 etapas; criação do pedido com protocolo e chave de acesso; anexos; PDF do
  requerimento; tela de sucesso.

### Modified Capabilities

(nenhuma — `openspec/specs/` ainda não tem specs sincronizadas)

## Impact

- `src/app/`: `globals.css` novo (Tailwind `@theme`), `layout.tsx` (fontes, CSS vars do tenant),
  `page.tsx` reescrita, rotas novas `solicitar/` e stub `protocolo/`.
- `src/core/`: `acts/catalog.ts` expandido (modo de tramitação, documentos, exemplos);
  `tenant/schema.ts` ganha `brand` (paleta + serifada); núcleo novo de pedido
  (protocolo, chave de acesso) puro e testado com `node --test`.
- `src/db/`: tabelas novas de pedido de serviço e anexos + migração (expand-only).
- Dependências novas: geração de PDF (pdfkit, como no sistema anterior) e `@vercel/blob` para
  anexos em produção.
- `public/`: `hero-home.jpg` (export do projeto de design).
- E2E Playwright: jornada solicitar completa (mobile viewport primeiro).
