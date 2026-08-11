## Context

O design da Entrega 11 (`temp/design/Redesign 11 - Centrais e Contato.dc.html`) desenha duas telas — "Centrais oficiais" (1a) e "Contato" (1b), desktop 1200 e mobile 390 — que substituem o placeholder `ComingSoon` hoje servido em `/centrais`. O projeto já tem tudo de que as telas precisam, menos duas coisas: o endereço da serventia (não existe no `TenantSchema`) e um catálogo das centrais nacionais.

Estado atual relevante:

- Seção gated `centrais-contato` já existe (`always`), rota `/centrais`, rótulo "Centrais e contato" no header e footer.
- `requireSection` (`src/app/(public)/_lib/section.ts`) é o controle de acesso de toda página pública gated.
- `ATTRIBUTION_SHORT_NAMES` / `ATTRIBUTION_NAMES` (`src/core/acts/catalog.ts`) são os rótulos dos chips do "Quem somos" que o design manda reusar.
- `isWithinChatHours` / `nextChatOpening` (`src/core/chat/hours.ts`) já calculam a janela de expediente (dia útil + `tenant.scheduling`) — exatamente o que o selo "Aberto agora" precisa.
- Tenants são config-as-code (`src/core/tenant/tenants/*.ts`) com overrides vindos do banco (`office-contact` etc.).
- Padrão visual: tokens `brand-*` (nenhum hex fora de `@theme`), `Icon` local com paths 24×24, páginas server-first, texto visível vindo de config quando é do tenant.

## Goals / Non-Goals

**Goals**

- Implementar `/centrais` e `/contato` fiéis ao design (desktop e mobile), com os padrões do projeto.
- Centrais agrupadas por atribuição e gated pelas atribuições do tenant; domínio oficial visível em cada cartão.
- Contato com canais acionáveis, selo aberto/fechado calculado, endereço + mapa ilustrativo + rota.
- Verificação visual pós-implementação com Playwright MCP (desktop 1200 / mobile 390) comparando com o design.

**Non-Goals**

- Mudar header/footer, rota ou rótulo da seção na navegação.
- Mapa real (embed/tiles de terceiros) — o design pede mapa ilustrativo justamente para eliminar o estado quebrado.
- Edição das centrais ou do endereço pelo painel admin (endereço entra como config-as-code; expor no painel é follow-up).
- Formulário de contato.

## Decisions

### 1. Duas rotas sob a mesma seção gated

`/centrais` (Centrais oficiais) e `/contato` (Contato), ambas chamando `requireSection("centrais-contato")`. O design as desenha como páginas distintas com headers próprios. A navegação global não muda (não-objetivo); a descoberta do Contato se dá por cross-link no topo de `/centrais` ("Endereço e horário → Contato") e vice-versa ("Links oficiais → Centrais"), além do footer que já mostra telefone/e-mail/horário.

*Alternativa considerada*: uma página única com as duas seções — rejeitada porque o design separa as telas e o conteúdo de contato ficaria enterrado sob sete cartões de centrais.

### 2. Catálogo de centrais em `src/core/portals/catalog.ts`

Dados nacionais da plataforma (nunca por tenant), como `ATTRIBUTION_NAMES`: constantes puras + uma função `portalGroupsFor(attributions)` que devolve só os grupos cuja atribuição o tenant tem. Grupos e cartões, conforme o design:

| Grupo (rótulo do design) | Atribuições | Cartões | Domínio |
| --- | --- | --- | --- |
| — (destaque) | sempre | SERP · Sistema Eletrônico dos Registros Públicos ("Portal único") | `serp.onr.org.br` |
| Registro Civil | RCPN | CRC Nacional / Meu Registro Civil | `registrocivil.org.br` |
| Tabelionato de Notas | NOTAS | e-Notariado; CENSEC | `e-notariado.org.br`; `censec.org.br` |
| Protesto de Títulos | PROTESTO | CENPROT | `site.cenprot.org.br` |
| Registro de Imóveis | RI | Registro de Imóveis (ONR / SREI) | `registradores.onr.org.br` |
| Títulos e Documentos · Pessoas Jurídicas | RTD, RCPJ | RTDPJ Brasil | `rtdbrasil.org.br` |

Cada cartão: `name`, `description` (texto do design), `domain` (chip com cadeado) e `url` (`https://` + domínio; abre em `target="_blank" rel="noopener"`). O grupo aparece se a interseção com `tenant.attributions` for não vazia. O SERP e a faixa de confiança aparecem sempre. Teste em `node --test` cobre o gating por atribuição.

*Alternativa*: constantes dentro da página — rejeitada; regra (gating por atribuição) pertence ao núcleo puro.

### 3. `address` opcional no `TenantSchema`

`address: z.string().min(1).optional()`. Opcional pelo mesmo motivo do `pix.city`: tenants já registrados (arquivos e futuros registros via Átrios) não têm o campo e não há migração para backfill. Sem endereço, a página de contato omite o cartão de endereço/mapa — nunca um estado quebrado. `marinho.ts` recebe `"Rua José Camilo Bezerra, 44, Centro, Ielmo Marinho / RN"`; aurora e bom-jesus recebem endereço demo se houver um plausível, senão ficam sem.

### 4. Selo "Aberto agora" reusa `isWithinChatHours`

O expediente do selo é o mesmo do chat e do agendamento (`tenant.scheduling`), então o selo chama `isWithinChatHours(tenant, new Date())` e, quando fechado, `nextChatOpening` para a linha "abre segunda às 8h". Nenhuma função nova no núcleo além de, se preciso, um helper de formatação. Estados:

- Aberto: chip verde (`brand-tint`-como no design: fundo `#e5f0e8` → token existente de sucesso/tint) — "Aberto agora · fecha às {endHour}h".
- Fechado: chip neutro — "Fechado agora · abre {dia} às {startHour}h" (dia via `Intl` em `America/Sao_Paulo`; "hoje" quando ainda vai abrir no mesmo dia).

A página é dinâmica por natureza (`getTenant` lê headers), então o cálculo por request é correto.

### 5. Canais acionáveis

- **WhatsApp**: `https://wa.me/55{digits(tenant.contacts.whatsapp)}` — mesmo padrão de `agendar/appointment-form.tsx`.
- **Ligar** (só mobile no design): `tel:+55{digits(phone)}`.
- **Copiar e-mail**: componente cliente pequeno (`copy-email-button.tsx`) com `navigator.clipboard` e feedback "Copiado!" que reverte após ~2s; fallback: o e-mail é texto selecionável.
- **Como chegar**: `https://www.google.com/maps/dir/?api=1&destination={encodeURIComponent(address)}` — abre o app de mapas do aparelho; nada embutido na página.
- **Faixa "prefere resolver sem sair de casa?"**: links para `/solicitar` e `/agendar`; o botão "Atendimento online" abre o chat via `CustomEvent` (`veridia:open-chat`) que o `ChatWidget` passa a escutar — o widget já está montado em toda página pública. O botão só aparece quando o chat do tenant está ligado (`isChatEnabled`, mesmo gate do layout).

### 6. Mapa ilustrativo em CSS/SVG

Reproduz o desenho do design (gradiente, "ruas" claras rotacionadas, quadras, pin com rótulo da serventia e a legenda "mapa ilustrativo · abre no app de mapas") com divs posicionadas e um SVG de pin — cores via tokens `brand-*`/neutros já existentes, nunca hex na página. É decorativo: `aria-hidden`, e a informação real (endereço + botão) fica fora dele.

### 7. Ícones novos no `Icon`

Adicionar paths 24×24 do design a `icon.tsx`: `whatsapp` (balão), `mail` (envelope), `mapPin` e `arrowUpRight` (seta diagonal dos cartões de central). `lock`, `shield`, `info`, `clock`, `copy` já existem.

### 8. Verificação visual com Playwright MCP

Após implementar, com o dev server servindo `marinho.localhost`: capturar `/centrais` e `/contato` em viewport 1200×900 e 390×844, abrir também o arquivo do design, e comparar lado a lado (hierarquia, agrupamentos, chips de domínio, selo, mapa, faixas). Divergências viram ajustes até a fidelidade ficar satisfatória. A comparação é de julgamento visual, não pixel-diff: o design usa hex fixos da paleta verde-dourado e o site usa tokens do tema do tenant (idênticos para marinho).

## Risks / Trade-offs

- [Selo "aberto" ignora feriados municipais] → `isBusinessDay` já cobre fins de semana e feriados nacionais; feriado municipal mostraria "aberto" indevidamente — mesmo comportamento já aceito pelo chat e agendamento, não piora nada.
- [Domínios oficiais mudam (ex.: CENPROT já migrou de domínio uma vez)] → catálogo central único em `src/core/portals`; alterar um domínio é um diff de uma linha, coberto por teste.
- [`address` opcional pode deixar o Contato sem mapa em tenants novos] → degradação explícita (cartão omitido); o dia em que o painel expuser o campo, o gap se fecha sozinho.
- [Evento custom `veridia:open-chat` cria acoplamento implícito página→widget] → contrato de uma linha, documentado no widget; se o chat estiver desligado o botão nem renderiza.

## Migration Plan

Sem banco, sem duas fases: campo novo é opcional e config-as-code. Deploy único; rollback é reverter o commit. O `ComingSoon` continua existindo para as seções ainda não entregues.

## Open Questions

- Nenhuma bloqueante. (Se aurora/bom-jesus não tiverem endereço demo óbvio, ficam sem — comportamento definido na Decisão 3.)
