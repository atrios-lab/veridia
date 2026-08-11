## Why

A seção "Centrais e contato" (`/centrais`) é a última página pública ainda servida pelo placeholder `ComingSoon`. O redesign da Entrega 11 (`temp/design/Redesign 11 - Centrais e Contato.dc.html`) define as duas telas finais: **Centrais oficiais** agrupadas por atribuição com o domínio oficial visível em cada cartão (a página vira fonte confiável contra sites falsos, US da Entrega 6) e **Contato** com canais acionáveis, selo "Aberto agora" e mapa ilustrativo com rota — no lugar do placeholder.

## What Changes

- Página `/centrais` deixa de ser `ComingSoon` e passa a listar as centrais nacionais oficiais **agrupadas por atribuição** (Registro Civil, Notas, Protesto, Imóveis, Títulos e Documentos · Pessoas Jurídicas), com o SERP destacado como portal único de entrada.
- Cada cartão de central mostra o **domínio oficial** em chip com cadeado e abre o site em nova aba; faixa de confiança no topo avisa que todos os links levam a domínios oficiais e que a serventia nunca pede senha por essas centrais.
- Grupos de centrais são **gated por atribuição do tenant**: uma serventia sem RI não exibe o grupo Registro de Imóveis.
- Nova página `/contato`, sob a mesma seção gated `centrais-contato`, com: canais acionáveis (chamar no WhatsApp, ligar, copiar e-mail), selo **"Aberto agora / Fechado agora"** calculado pelo expediente do tenant, endereço com mapa ilustrativo (CSS, sem serviço externo, sem estado quebrado) e botão **"Como chegar"** que abre a rota no app de mapas, e faixa "prefere resolver sem sair de casa?" ligando para solicitar, agendar e atendimento online.
- Tenant ganha campo `address` (endereço da serventia), necessário para o Contato e o "Como chegar".
- Catálogo das centrais oficiais (nome, descrição, domínio, URL, atribuições) vive em `src/core`, sem hardcode na página.

## Capabilities

### New Capabilities

- `official-portals`: página pública de centrais oficiais agrupadas por atribuição, com domínio visível, faixa de confiança e SERP em destaque.
- `office-contact`: página pública de contato com canais acionáveis, indicador de aberto/fechado pelo expediente, endereço com mapa ilustrativo e rota.

### Modified Capabilities

<!-- Nenhuma: o shell público, o gating e a home não mudam de requisito; as duas páginas novas entram sob a seção `centrais-contato` já existente. -->

## Impact

- `src/app/(public)/centrais/page.tsx` — reescrita (sai o `ComingSoon`).
- `src/app/(public)/contato/` — nova rota, mesma seção `centrais-contato` (`requireSection`).
- `src/core/tenant/schema.ts` + `src/core/tenant/tenants/marinho.ts` — novo campo `address`.
- `src/core` — novo catálogo de centrais oficiais por atribuição; reuso de `isWithinChatHours`/`nextChatOpening` (`src/core/chat/hours.ts`) para o selo "Aberto agora".
- Componente cliente pequeno para "Copiar e-mail" (clipboard + feedback).
- Nenhuma migração de banco; nenhuma mudança no admin.

## Não-objetivos

- Não mudar o shell público (header/footer) nem o rótulo/rota da seção `centrais-contato` na navegação.
- Não integrar mapa real (Google Maps embed/tiles): o mapa é ilustrativo por decisão do design; só o botão "Como chegar" abre o app de mapas.
- Não criar formulário de contato: os canais são WhatsApp, telefone e e-mail; ouvidoria e LGPD continuam nos canais próprios.
- Não tornar as centrais editáveis pelo admin: o catálogo é da plataforma (dados nacionais), não do tenant.
