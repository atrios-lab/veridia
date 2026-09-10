## Why

O Provimento n. 7/2026 da Corregedoria-Geral de Justiça do TJRN (publicado 08/09/2026) regulamenta
a gratuidade de taxas e emolumentos do RCPN para hipossuficientes e diverge, em pontos concretos,
do fluxo "Solicitar gratuidade (isento)" já implementado no veridia: o sistema hoje exige anexo de
comprovante como pré-requisito bloqueante (o Provimento diz que a declaração já basta), e trata
certidão de nascimento/óbito — gratuita para qualquer pessoa por lei, sem formulário — como se
dependesse da mesma declaração de hipossuficiência que a habilitação de casamento exige. Adequar
agora evita protocolar pedidos em desacordo com a norma vigente e cobrir uma lacuna de formalização
(assinatura a rogo/representante legal) que o Provimento passa a exigir.

## What Changes

- A declaração de hipossuficiência marcada passa a ser suficiente por si só para protocolar o
  pedido de gratuidade; o anexo de comprovante do benefício deixa de ser obrigatório e vira
  opcional (quem tiver, anexa; a ausência não bloqueia o protocolo).
- O catálogo separa, dentro da atribuição RCPN, o registro de nascimento e o assento de óbito (com
  a 1ª certidão respectiva) — gratuitos por lei para qualquer pessoa, sem declaração de
  hipossuficiência — dos demais pedidos de certidão, que continuam exigindo a declaração quando
  isentos por hipossuficiência.
- O pedido de gratuidade passa a identificar separadamente o beneficiário e, quando aplicável,
  quem formaliza a declaração em seu lugar: representante legal ou assinatura a rogo (pessoa que
  assina porque o beneficiário não sabe ou não pode assinar), com espaço para duas testemunhas no
  requerimento impresso quando a declaração for a rogo.
- A lista de categorias de documento de transparência ganha uma entrada para o cartaz informativo
  de gratuidade e isenção (Anexo II do Provimento), que a serventia publica como qualquer outro
  documento de transparência já publica hoje (ex.: "Tabela de emolumentos").
- **BREAKING**: nenhuma. Pedidos de gratuidade já protocolados continuam legíveis; a mudança só
  afeta a validação de novos pedidos e a oferta do catálogo.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `service-request`: o requirement "Solicitação de gratuidade (ISENTO) nos atos que a lei isenta"
  muda em três pontos — o anexo deixa de ser obrigatório, a certidão de RCPN oferecida como
  ato-alvo passa a excluir nascimento e óbito (que não entram no formulário de gratuidade), e o
  formulário passa a suportar representante legal / assinatura a rogo com testemunhas.

## Impact

- `src/core/acts/catalog.ts`: `rcpn-certidao` deixa de cobrir nascimento/óbito no mesmo item que
  oferece `feeExemption`; `FEE_EXEMPTION_DOCUMENTS` e o texto ao redor passam a descrever o anexo
  como opcional.
- `src/core/request/form.ts` e `src/app/(public)/solicitar/actions.ts`: remove o bloqueio por
  ausência de anexo; adiciona validação dos novos campos de representante legal/rogo.
- `src/core/request/kinds.ts`: `exemption` ganha os campos de quem formalizou a declaração.
- `src/core/request/requerimento.ts`: a declaração de gratuidade impressa passa a identificar
  separadamente beneficiário e quem assina, com linhas de testemunha quando for a rogo.
- `src/app/(public)/solicitar/request-form.tsx`: UI do passo de gratuidade ganha os campos novos e
  deixa de exigir anexo.
- `src/core/transparency/documents.ts`: `DOCUMENT_CATEGORIES` ganha uma entrada nova.
- Fora de escopo, por não se aplicar ao que o veridia produz: art. 10 (texto "isento de
  emolumentos" no ato praticado — o veridia gera o requerimento, não o ato/certidão final, que sai
  de outro sistema da serventia); art. 11 (encaminhamento ao Juiz Corregedor em caso de dúvida
  sobre veracidade — procedimento manual/jurídico da serventia, sem necessidade de suporte no
  sistema); art. 15 (selo do tipo isento — emitido pelo sistema do TJ/SIEX na prática do ato, fora
  do veridia); art. 6º (orientação de conduta do atendente, não é regra de sistema); art. 9º
  (exclusões de despesas postais/diligências, não se aplicam ao fluxo online); art. 13
  (confidencialidade do formulário — já atendida pelo desenho atual de anexos em área autenticada).
