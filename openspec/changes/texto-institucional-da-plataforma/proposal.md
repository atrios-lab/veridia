## Why

O carimbo da declaração de hipossuficiência (change `redesenhar-declaracao-com-carimbo`, PR
#107) já diz que o pedido chegou pela "Plataforma Eletrônica Oficial da Serventia", com base no
art. 208, II, "b", do Código Nacional de Normas do CNJ (Foro Extrajudicial), na redação do
Provimento CNJ n. 180/2024. Mas o site que recebe esses pedidos não se apresenta assim em lugar
nenhum: o rodapé diz só "presença digital em conformidade com a LGPD e o Provimento 213 do
CNJ", e não existe página que explique o que a plataforma é, sob qual norma ela recebe pedidos
e que os pedidos eletrônicos entram só pelas Centrais Nacionais ou por este site.

A serventia escreveu esse texto (mensagens do Joelison de 20:38, 21:01 e 21:09) para duas
finalidades: mostrar ao cidadão e ao fundo (FCRCPN) que o canal é oficial, e poder recusar
pedido que chegue por WhatsApp ou e-mail apontando a regra. O carimbo cobre a primeira metade
no papel; esta change cobre o site.

## What Changes

- **Página institucional `/plataforma`**, com a identidade do tenant, no mesmo molde da política
  de privacidade: o que é a plataforma (texto do art. 208, II, "b" e do Provimento 180/2024), a
  regra de canal (pedidos eletrônicos são feitos exclusivamente pelas Centrais Oficiais
  Nacionais reconhecidas pelo CNJ ou diretamente por este site), as diretrizes de segurança que
  ela observa (Provimento CNJ n. 213/2026, com as alterações do n. 243/2026), o lema
  "Autenticidade • Integridade • Segurança • Rastreabilidade" e a nota de proteção de dados
  (LGPD e normas dos serviços extrajudiciais), com link para a política de privacidade.
- **Rodapé do site**: o parágrafo institucional passa a nomear a plataforma e a sua base
  ("Plataforma Eletrônica Oficial da Serventia, nos termos do art. 208, II, "b", do CNN-CNJ,
  Provimento CNJ n. 180/2024") e ganha o link "Sobre a plataforma", ao lado de "Política de
  privacidade", no grupo Cidadão.
- **Tela "Solicitar"**: uma linha discreta no topo do fluxo de pedido, dizendo que o pedido é
  recebido pela plataforma oficial da serventia, com link para `/plataforma`. É o momento em
  que a afirmação importa ao cidadão; não é pop-up.
- **Textos no core**: as frases novas (regra de canal, diretrizes 213/243, nota LGPD) entram em
  `src/core/acts/catalog.ts` ao lado de `PLATFORM_STATEMENT`, para o site e o carimbo lerem a
  mesma redação e para o teste que proíbe "o Provimento 7 autoriza a plataforma" cobri-las.
- Sem pop-up. O texto tem valor institucional, não operacional; um modal a cada visita é
  fechado sem leitura e concorre com o aviso de cookies no mesmo canto. Se a serventia insistir,
  entra depois como aviso de primeira visita (ver design, alternativa descartada).
- **BREAKING**: nenhuma. Página nova, texto novo no rodapé, uma linha nova em `/solicitar`.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `public-site-foundation`: o requirement "Shell público com navegação gated" passa a exigir a
  identificação institucional da plataforma no rodapé e o link para a página; e entra o
  requirement "Página institucional da plataforma" (`/plataforma`, sempre habilitada, fora do
  gating por seção, como `/privacidade`).
- `service-request`: o requirement do fluxo de pedido ganha a linha de apresentação da
  plataforma no início do wizard.

## Impact

- Nova `src/app/(public)/plataforma/page.tsx`, no molde de `privacidade/page.tsx`.
- `src/app/(public)/layout.tsx`: parágrafo do rodapé e link "Sobre a plataforma".
- `src/app/(public)/solicitar/page.tsx`: linha com link no topo do wizard.
- `src/core/acts/catalog.ts`: `PLATFORM_CHANNEL_RULE`, `PLATFORM_SECURITY_STATEMENT`,
  `PLATFORM_DATA_PROTECTION`; `catalog.test.ts` cobre as novas.
- E2e: `tenants.spec.ts` compara os `data-section` do rodapé como conjunto; o link novo não leva
  `data-section` (como o de privacidade) e não entra na comparação. Um teste novo confere que
  `/plataforma` abre, tem o nome do tenant e cita o Provimento 180/2024.
- Sem migração, sem dependência nova, sem mudança no painel.

## Non-Goals

- Pop-up ou modal na entrada do site.
- Mudar o texto do carimbo do PDF: ele já cita a mesma base e fica como está.
- Bloquear tecnicamente pedidos por outros canais: a regra é texto que a serventia invoca, não
  código.
- Confirmar a vigência do Provimento 243/2026: a página o cita como a serventia escreveu; a
  data de vigência segue pendente na change `add-compliance-intake` e não é decidida aqui.
