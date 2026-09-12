## Context

O site público tem um rodapé compartilhado por toda página (`src/app/(public)/layout.tsx`),
com um parágrafo institucional fixo ("Serventia dotada de fé pública. Presença digital em
conformidade com a LGPD e o Provimento 213 do CNJ."), grupos de links que espelham os menus e,
no grupo Cidadão, o link "Política de privacidade" para `/privacidade`, uma página fixa de texto
com os dados do tenant interpolados. O wizard de pedido (`solicitar/page.tsx`) abre com o
eyebrow "Serviços on-line" e um título. O aviso de cookies e o chat ocupam o canto inferior
direito e se coordenam pelo cookie do aviso.

Os textos da plataforma já existem no core desde o carimbo: `PLATFORM_STATEMENT` (art. 208,
II, "b"; Prov. 180/2024), `PLATFORM_MOTTO` e `PLATFORM_FOOTER_LINE`. Faltam as frases que só o
site diz: a regra de canal (versão das 20:38), as diretrizes de segurança (213/243, versão das
21:09) e a nota LGPD.

## Goals / Non-Goals

**Goals:** o site diz o que a plataforma é e sob qual norma recebe pedidos, num lugar que o
cidadão encontra e que a serventia pode apontar; o texto é o da serventia, guardado no core, uma
redação só para site e PDF.

**Non-Goals:** os do proposal (pop-up, carimbo, bloqueio de canal, vigência do 243).

## Decisions

### 1. Uma página fixa, `/plataforma`, no molde da política de privacidade

Server component, sem estado, `metadata.title = "Sobre a plataforma"`, mesma estrutura visual
de `privacidade/page.tsx` (eyebrow com o nome do tenant, título serifado, seções). Fora do
gating por seção: como `/privacidade`, existe em todo tenant. Alternativa: seção nova em
`SECTIONS` com toggle. Descartada: não há tenant para o qual faça sentido esconder o que a
plataforma é.

Seções: "O que é esta plataforma" (`PLATFORM_STATEMENT`), "Por onde os pedidos entram"
(`PLATFORM_CHANNEL_RULE`), "Segurança e rastreabilidade" (`PLATFORM_SECURITY_STATEMENT` +
lema), "Seus dados" (`PLATFORM_DATA_PROTECTION` + link para `/privacidade`). O nome do tenant
entra no título da página e no eyebrow; os textos não interpolam nada.

### 2. Rodapé: nomear a plataforma no parágrafo que já existe, e um link

O parágrafo passa a: "Serventia dotada de fé pública. Plataforma Eletrônica Oficial da
Serventia, nos termos do art. 208, II, "b", do Código Nacional de Normas do CNJ (Provimento CNJ
n. 180/2024), em conformidade com a LGPD e o Provimento CNJ n. 213/2026." Curto o bastante para
a coluna do rodapé; a versão longa fica na página. O link "Sobre a plataforma" entra no grupo
Cidadão, antes de "Política de privacidade", sem `data-section` (o e2e de gating compara os
`data-section` do rodapé como conjunto e não deve enxergar esse link).

### 3. Linha no topo do wizard, não pop-up

Em `solicitar/page.tsx`, sob o título, uma linha em `text-brand-muted`: "Pedido recebido pela
Plataforma Eletrônica Oficial da Serventia (Provimento CNJ n. 180/2024). Saiba mais." com o
link para `/plataforma`. É onde a afirmação tem efeito: quem está prestes a pedir. Alternativa:
modal na primeira visita, com cookie de dispensa como o aviso de cookies. Descartada: dois
avisos no primeiro acesso, no mesmo canto, um deles com texto normativo que ninguém lê num
modal; e a home já é o lugar de apresentação da serventia, não da norma.

### 4. Textos no core, testados

`PLATFORM_CHANNEL_RULE`: "Nos termos do Provimento n. 180 do Conselho Nacional de Justiça
(CNJ), que disciplina o uso de plataformas eletrônicas de serviços extrajudiciais, os pedidos
de registro eletrônico devem ser realizados exclusivamente pelas Centrais Oficiais Nacionais,
reconhecidas pelo CNJ, ou, ainda, diretamente pelo site institucional deste Cartório."
`PLATFORM_SECURITY_STATEMENT`: "A plataforma observa as diretrizes de segurança, integridade,
disponibilidade, autenticidade e rastreabilidade estabelecidas pelo Provimento CNJ n. 213/2026,
com as alterações promovidas pelo Provimento CNJ n. 243/2026." `PLATFORM_DATA_PROTECTION`:
"Seus dados pessoais são protegidos e tratados em conformidade com a Lei Geral de Proteção de
Dados Pessoais (LGPD, Lei n. 13.709/2018) e com as normas aplicáveis aos serviços
extrajudiciais." O teste de `catalog.test.ts` que proíbe "Provimento 7 autoriza a plataforma"
passa a cobrir as três. Sem travessão nem meia-risca (`check:dashes`).

## Risks / Trade-offs

- [O rodapé cresce uma linha e meia no celular] → O parágrafo já existe; a coluna tem
  `max-w-sm` e o texto novo tem tamanho parecido com o atual.
- [O Provimento 243/2026 é citado sem a vigência confirmada] → É a redação da serventia; a
  página diz o que ela diz. A confirmação continua na change `add-compliance-intake`.
- [E2e de gating lê o rodapé] → O link novo não leva `data-section`; o teste do rodapé compara
  só os que levam.

## Migration Plan

Deploy único, sem banco. Rollback é reverter.

## Open Questions

- Se a serventia quiser o pop-up mesmo assim, entra como aviso de primeira visita com cookie de
  dispensa, coordenado com o aviso de cookies (um de cada vez). Não está nesta change.
