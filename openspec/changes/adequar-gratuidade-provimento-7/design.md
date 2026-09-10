## Context

O fluxo "Solicitar gratuidade (isento)" nasceu de duas changes já arquivadas
(`add-fee-exemption-request`, `solicitar-gratuidade-como-ato`) e ficou pendente de confirmação da
serventia sobre o texto da declaração e a lista de documentos aceitos — pendência que o Provimento
n. 7/2026 (Corregedoria-Geral de Justiça do TJRN) agora resolve por norma: a declaração já basta
(art. 5º), o anexo não pode ser pré-requisito.

O catálogo hoje tem um único item `rcpn-certidao` ("Certidão (nascimento, casamento, óbito)") que
carrega `feeExemption` com base legal "CF art. 5º, LXXVI; Lei 6.015 art. 30 §1º (Lei 9.534/97)".
Essa base legal é, na verdade, inteiramente sobre nascimento/óbito: a CF art. 5º LXXVI cita
"notadamente do registro civil de nascimento e da certidão de óbito", e a Lei 9.534/97 é
precisamente a lei que tornou o registro de nascimento, o assento de óbito e a respectiva primeira
certidão **gratuitos para qualquer pessoa**, independente de renda — não uma isenção condicionada à
hipossuficiência. O Provimento confirma isso no art. 3º §1º, I e II: dispensa o formulário de
hipossuficiência para esses dois casos, sem ressalva de pobreza.

Ou seja, o item de catálogo estava (a) oferecendo/exigindo uma declaração de pobreza para um
direito que já é incondicional, e (b) citando como "isenção por hipossuficiência" uma norma que na
verdade não condiciona nada a hipossuficiência nenhuma. `rcpn-habilitacao-casamento`, ao contrário,
tem uma base legal própria e genuinamente condicionada à pobreza (CC art. 1.512, parágrafo único) e
não é afetada por este design.

O site nunca cobra nem cota preço (comentário em `catalog.ts`: "Not a price: the site never quotes
one") — quem decide valor é o operador, fora deste fluxo. Por isso a mudança aqui é só sobre
**quando oferecer/exigir a declaração**, não sobre cálculo de emolumento.

## Goals / Non-Goals

**Goals:**
- Tornar o anexo de comprovante opcional no pedido de gratuidade, mantendo a declaração como
  suficiente (art. 5º do Provimento).
- Parar de oferecer/exigir a declaração de hipossuficiência para certidão de nascimento e de óbito
  (1ª via), que são gratuitas por lei para qualquer pessoa (art. 3º §1º, I e II).
- Permitir que a declaração de gratuidade seja formalizada por representante legal ou por
  assinatura a rogo, com o requerimento impresso trazendo o espaço adequado a cada caso (arts. 4º e
  7º).
- Publicar o cartaz informativo de gratuidade e isenção (Anexo II) pelo mesmo caminho que qualquer
  documento de transparência já publica hoje.

**Non-Goals:**
- Não implementar o formulário eletrônico nacional (ON-RCPN/SERP) nem integrar com ele — é uma
  plataforma do Operador Nacional, fora do veridia.
- Não automatizar o procedimento de dúvida sobre veracidade / encaminhamento ao Juiz Corregedor
  Permanente (art. 11) — é decisão jurídica da serventia, tratada fora do sistema.
- Não gerar nem consultar o "selo do tipo isento" (art. 15) — é emitido pelo sistema do TJ (SIEX)
  na prática do ato final, que o veridia não emite.
- Não inserir o texto "isento de emolumentos" em nenhum documento (art. 10): o veridia produz o
  requerimento (o pedido do cidadão), não o ato praticado/certidão final, que sai de outro sistema
  da serventia — o artigo não se aplica ao que este sistema gera.
- Não coletar nomes de testemunhas como dado de formulário online: testemunhas são escolhidas e
  assinam fisicamente no balcão, no momento da assinatura a rogo — o requerimento só reserva o
  espaço.

## Decisions

### 1. Anexo vira opcional, não removido
O campo de anexo continua existindo e a lista `FEE_EXEMPTION_DOCUMENTS` continua sendo mostrada
(ajuda quem tem o comprovante a saber o que serve), mas `actions.ts` deixa de recusar o pedido por
`countAttachments(formData) === 0`. A declaração marcada — sozinha — passa a bastar, como manda o
art. 5º. Alternativa descartada: remover o anexo da tela inteiramente — descartada porque nada no
Provimento proíbe anexar, e o comprovante ainda ajuda a serventia a conferir mais rápido quando o
cidadão o tem.

### 2. Separar nascimento/óbito de outras certidões por um novo item de catálogo, não por um
   seletor de subtipo dentro do mesmo item
`rcpn-certidao` vira dois itens:
- `rcpn-certidao-nascimento-obito` — "Certidão de nascimento ou óbito", **sem** `feeExemption`
  (gratuita por lei, sem declaração — Lei 6.015 art. 30 §1º, red. Lei 9.534/97).
- `rcpn-certidao` — mantém o id e passa a nomear "Certidão de casamento e demais certidões do
  RCPN", com o `feeExemption` que hoje existe permanecendo como está (CF art. 5º, LXXVI), já que a
  base do casamento não muda com este Provimento.

Alternativa considerada: manter um único item com um campo `subtype` (nascimento/óbito/casamento)
que decide se a gratuidade é oferecida. Descartada porque introduziria um campo novo no schema só
para portar uma decisão que o catálogo já resolve sozinho ao virar dois itens — e dois itens
deixam explícito, na tela "Escolha o ato", que são pedidos diferentes (um deles sem qualquer
formalidade de gratuidade), em vez de um formulário condicional que muda de cara conforme uma
escolha interna.

O placeholder do campo de descrição livre (`request-form.tsx`), hoje com exemplo de casamento,
passa a ser o exemplo certo para cada item.

**Questão em aberto (vai para `tasks.md` como confirmação pendente com a serventia):** o item novo
assume que todo pedido de certidão de nascimento/óbito feito por aqui é "a primeira certidão
respectiva" (art. 3º §1º, I/II). Se a serventia também recebe pedidos de segunda via por este
mesmo canal, precisa dizer se quer tratá-los igual (sem formalidade) ou se precisa de um jeito de
marcar "não é a primeira via" — isso não está resolvido neste design.

### 3. Quem assina a declaração: campo de escolha de três posições, sem coletar testemunhas
No passo de gratuidade, um campo (rádio) pergunta quem formaliza a declaração: a própria pessoa
beneficiária (padrão), um representante legal, ou assinatura a rogo. Selecionando as duas últimas,
um campo de texto pede o nome de quem assina. Esse nome (quando presente) é gravado em
`details.exemption` e impresso no requerimento junto com o nome do beneficiário, identificados
separadamente (art. 4º §3º). Quando a opção é "a rogo", o requerimento ganha duas linhas de
assinatura de testemunha em branco e a nota de que o conteúdo foi lido em voz alta e explicado ao
beneficiário (art. 7º, I) — testemunhas não são coletadas como dado, só o espaço físico para
assinarem no balcão.

Alternativa descartada: pedir os nomes das testemunhas no formulário online. Descartada porque
testemunhas costumam ser escolhidas no momento da assinatura presencial (funcionário da serventia,
acompanhante), não antes — pedir isso antecipadamente inventaria um dado que não existe ainda no
momento em que o formulário é preenchido.

### 4. Cartaz de transparência entra como categoria nova, sem capability própria
`DOCUMENT_CATEGORIES` (`src/core/transparency/documents.ts`) ganha `"Cartaz de gratuidade e
isenção"`. Não há spec de capability governando essa lista hoje (é upload manual de PDF pela
serventia, sem requisito formal registrado em `openspec/specs/`) — a mudança é só a linha nova,
consistente com o comentário já existente no arquivo ("Adding one is a line here").

## Risks / Trade-offs

- [Dois itens de catálogo em vez de um podem confundir quem já se acostumou com "Certidão
  (nascimento, casamento, óbito)"] → Mitigação: nomes claros na lista de atos, e o item de
  nascimento/óbito, por não pedir mais nada de hipossuficiência, fica mais simples de usar, não
  mais confuso.
- [Pedidos de gratuidade já protocolados antes desta mudança apontam para o `id` antigo de
  `rcpn-certidao`, que passa a significar "casamento e demais", não mais "nascimento, casamento,
  óbito"] → Mitigação: o texto do ato gravado no pedido antigo (`requerimento.ts` já trata pedido
  sem `actId` como caso legível sem erro); o `id` não muda de significado retroativamente porque
  pedidos antigos de nascimento/óbito não tinham por que ter passado pelo fluxo de gratuidade
  (art. 3º §1º já os dispensava por natureza, mesmo antes do Provimento formalizar isso).
- [O campo de representante legal/rogo é novo e pode ficar sem uso se a maioria dos pedidos online
  já for feita pela própria pessoa] → Aceito: o campo é opcional e não deveria aparecer inflado
  para o caso comum; a complexidade só aparece a quem precisa dela.

## Migration Plan

Sem migração destrutiva de banco: `details.exemption` já é um campo JSON flexível
(`src/core/request/kinds.ts`), então os campos novos (`signedBy`, `signerName`) são adicionados de
forma aditiva — pedidos antigos continuam lidos sem eles (`undefined` é um valor válido). O
`rcpn-certidao` que vira "Certidão de casamento e demais certidões" mantém o mesmo `id`, então
nenhum pedido histórico perde a referência ao ato. Deploy único, sem expand/contract.
