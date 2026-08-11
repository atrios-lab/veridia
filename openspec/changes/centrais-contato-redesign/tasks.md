## 1. Núcleo (src/core)

- [x] 1.1 Adicionar `address: z.string().min(1).optional()` ao `TenantSchema` (`src/core/tenant/schema.ts`) e preencher em `tenants/marinho.ts` ("Rua José Camilo Bezerra, 44, Centro, Ielmo Marinho / RN"); aurora e bom-jesus só se houver endereço demo plausível
- [x] 1.2 Criar `src/core/portals/catalog.ts`: tipos `OfficialPortal`/`PortalGroup`, catálogo com os grupos e cartões do design (SERP destacado; CRC, e-Notariado, CENSEC, CENPROT, ONR/SREI, RTDPJ com domínio, URL e descrição) e `portalGroupsFor(attributions)` filtrando por interseção
- [x] 1.3 Criar `src/core/portals/catalog.test.ts` (node --test): tenant completo vê todos os grupos; tenant sem RI não vê Registro de Imóveis; RTD ou RCPJ sozinho ainda vê o grupo de Títulos e Documentos

## 2. Ícones e widget

- [x] 2.1 Adicionar paths 24×24 do design ao `Icon` (`_components/icon.tsx`): `whatsapp`, `mail`, `mapPin`, `arrowUpRight`
- [x] 2.2 `chat-widget.tsx`: escutar `veridia:open-chat` (CustomEvent) chamando `openWidget`, com comentário de uma linha documentando o contrato

## 3. Página /centrais

- [x] 3.1 Reescrever `src/app/(public)/centrais/page.tsx` (sai o `ComingSoon`): `requireSection`, eyebrow "Plataformas nacionais", h1 "Centrais oficiais", lead, faixa de confiança (escudo + texto do design) e cross-link para `/contato`
- [x] 3.2 Cartão SERP em destaque (fundo `brand-primary`, selo "Portal único", botão branco com domínio + seta) — fiel ao design desktop e mobile
- [x] 3.3 Grupos por atribuição via `portalGroupsFor(tenant.attributions)`: divisor com rótulo em caixa alta + linha, grade 2 colunas no desktop / empilhado no mobile, cartões com nome serif, descrição, chip de domínio com cadeado e seta `arrowUpRight`
- [x] 3.4 Cartão de apoio final (fundo `brand-accent-soft`, ícone info): "Não achou o que precisa? Peça direto ao cartório" → `/solicitar`, menção ao atendimento/contato → `/contato`
- [x] 3.5 Atualizar `metadata.title` ("Centrais oficiais")

## 4. Página /contato

- [x] 4.1 Criar `src/app/(public)/contato/page.tsx`: `requireSection("centrais-contato")`, eyebrow "Onde nos encontrar", h1 "Contato", selo aberto/fechado via `isWithinChatHours`/`nextChatOpening` ("Aberto agora · fecha às {endHour}h" / "Fechado agora · abre {dia} às {startHour}h", dia via Intl em America/Sao_Paulo), cross-link para `/centrais`
- [x] 4.2 Cartão WhatsApp/telefone: número do tenant, botão "Chamar no WhatsApp" (`wa.me/55…`) e, no mobile, botão "Ligar" (`tel:+55…`)
- [x] 4.3 Criar `copy-email-button.tsx` (client): clipboard + "Copiado!" revertendo após ~2s; cartão de e-mail usa o componente
- [x] 4.4 Cartão de horário: `tenant.openingHours` + nota "Sem fechar para almoço… canais online funcionam a qualquer hora"; aviso Ouvidoria/Canal LGPD (fundo `brand-accent-soft`) com links para `/ouvidoria` e `/lgpd`
- [x] 4.5 Cartão de endereço (só quando `tenant.address` existe): endereço, botão "Como chegar" (`google.com/maps/dir/?api=1&destination=…`) e mapa ilustrativo em CSS/SVG (`aria-hidden`, legenda "mapa ilustrativo · abre no app de mapas"), grid desktop 400px+1fr, mobile empilhado com mapa no topo do cartão
- [x] 4.6 Faixa final escura "Prefere resolver sem sair de casa?": botões `/solicitar`, `/agendar` e "Atendimento online" (dispara `veridia:open-chat`; renderizado só com `isChatEnabled`)
- [x] 4.7 `metadata.title` ("Contato")

## 5. Qualidade e verificação visual

- [x] 5.1 Rodar `pnpm lint`, `pnpm typecheck` e `pnpm test`; conferir `check:tokens` (nenhum hex fora de @theme)
- [x] 5.2 Subir o dev server e, via Playwright MCP em `http://marinho.localhost:3000`, capturar `/centrais` e `/contato` em 1200×900 e 390×844
- [x] 5.3 Abrir `temp/design/Redesign 11 - Centrais e Contato.dc.html` no Playwright, comparar com as capturas (hierarquia, agrupamentos, chips, selo, mapa, faixas) e aplicar ajustes até a fidelidade ficar satisfatória
- [x] 5.4 Testar interações reais no navegador: copiar e-mail, links wa.me/tel/como chegar, "Atendimento online" abrindo o chat, e a página com seção desabilitada retornando 404
