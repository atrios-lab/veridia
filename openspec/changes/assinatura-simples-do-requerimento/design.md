## Context

O pedido pelo site nasce em `submitServiceRequest` (`src/app/(public)/solicitar/actions.ts`).
O submit valida o formulário com `publicServiceRequestSchema`, carimba `consentedAt`, lê o IP
com `clientIp(requestHeaders)` e chama `createServiceRequest`. O protocolo nasce dentro de
`createRecordWith`, que gera a sequência e insere a linha. Os aceites de LGPD e veracidade vão
para `details.consents`. Na gratuidade, `buildExemptionDetails` grava `declaredAt` e
`acceptance.ip` em `details.exemption`.

O requerimento é conteúdo puro: `buildRequerimento` (`src/core/request/requerimento.ts`)
devolve seções, linhas e parágrafos, e termina com `signee` e `signature`, o parágrafo
"Assine este requerimento pelo Gov.br…". `src/lib/pdf.ts` (`renderDocuments`) o desenha. A
declaração tem renderizador próprio (`src/lib/pdf-form.ts`), e é nele que vive `drawStamp`, o
carimbo "Certificação de recebimento eletrônico" montado por `buildStamp`
(`src/core/request/declaracao.ts`). O hash da declaração, `acceptanceHash`
(`src/core/request/acceptance.ts`), é JSON canônico mais SHA-256, recalculado a cada download
a partir de `details.exemption`.

Fatos que pesam:
- O painel corrige nome, contato, telefone, CPF, finalidade, descrição e `createdAt` de um
  pedido já protocolado (`updateRequestDataAction`, requisito "Corrigir os dados protocolados").
  Um hash recalculado dos dados atuais mudaria em silêncio depois de uma correção.
- `request-form.tsx` é client component. `acceptance.ts` importa `node:crypto` e não pode
  entrar no grafo do cliente.
- A via assinada hoje é só anexo `signed-form` (`signedDocumentAttachment` em
  `src/core/request/attachment.ts`). Consulta, acompanhamento, painel e overview leem
  `hasSignedForm` a partir dele.
- A change `via-assinada-no-painel` está implementada e ainda não arquivada. Os deltas desta
  change partem do texto dela.

## Goals / Non-Goals

**Goals:**
- Nenhum pedido pelo site chega ao cartório sem o requerimento assinado.
- O que a pessoa assinou fica gravado e conferível, e não muda quando a serventia corrige
  dados.
- O carimbo afirma só o que o sistema sabe com verdade.
- Pedidos antigos e pedidos do balcão não mudam de comportamento.

**Non-Goals:** os do proposal (declaração, balcão, assinatura avançada, confirmação de
contato, anexos, reassinatura).

## Decisions

### D1. O gesto é digitar o nome completo, conferido no servidor

O bloco "Revise e assine" tem um campo "Digite seu nome completo para assinar" e o botão
"Assinar e enviar pedido". O servidor normaliza o nome digitado e o do requerente (NFD sem
diacríticos, minúsculas, espaços colapsados, sem espaço nas pontas) e exige igualdade. Grava o
nome como foi digitado.

- *Alternativa: um terceiro quadrinho "Assino eletronicamente".* Recusada. Já há dois
  quadrinhos logo acima, e um terceiro some entre eles. Digitar o nome é um gesto que a pessoa
  reconhece como assinar, e dá ao carimbo um "Assinado por" escrito por ela.
- *Alternativa: aceitar qualquer nome.* Recusada. Um nome que não confere com o requerente é
  justamente o que faria a serventia desconfiar da assinatura.

A regra de normalização e a conferência vivem no core (`src/core/request/signature.ts`), sem
`node:crypto`, para o cliente usá-la e mostrar o erro antes do envio. O servidor confere de
novo.

### D2. O conteúdo assinado é uma cópia gravada, e o hash é gravado junto

`details.signature`:

```
{
  signedAt: string,        // ISO, o instante do submit
  typedName: string,       // como foi digitado
  ip?: string,
  textVersion: "1",        // versão de REQUERIMENTO_DECLARATIONS
  content: {               // o que foi assinado, campo a campo
    tenantSlug, protocolNumber, actId,
    applicantName, contact, phone?, cpf?,
    description?, purpose?, parameterValue?,
    exemptionActId?        // só a referência: a declaração não é assinada aqui
  },
  hash: string             // SHA-256 hex do JSON canônico de content + signedAt +
                           // typedName + textVersion + texto das declarações
}
```

- *Alternativa: recalcular o hash a cada download, como a declaração.* Recusada. A correção
  pelo painel mudaria o hash sem aviso, e a via impressa antes da correção deixaria de
  conferir. A declaração escapa disso porque o painel não corrige beneficiários. O requerimento
  não escapa.
- *Alternativa: gravar só o hash.* Recusada. Sem a cópia não dá para mostrar o que foi assinado
  depois de uma correção, nem recalcular o hash para conferir.
- *Por que gravar o hash se ele é recalculável da cópia:* o hash impresso no momento da
  assinatura tem que continuar o mesmo mesmo que a canonicalização mude no código. Um teste
  garante que o recálculo da cópia bate com o gravado na versão atual do código.

A cópia repete dados que já estão na linha. Isso é intencional: ela é a prova do que foi
assinado. Se o CPF for corrigido, o antigo continua na cópia. A retenção e o acesso são os do
próprio pedido (ver "Tratamento do IP" no proposal).

O canonicalizador de `acceptance.ts` passa a ser compartilhado (`canonicalJson` exportado ou
movido para um módulo próprio). Não se duplica.

### D3. O hash é calculado na mesma transação que gera o protocolo

O protocolo faz parte do conteúdo assinado e só existe dentro de `createRecordWith`.
`createServiceRequestWith` passa a aceitar um `sign?: (protocolNumber) => SignatureDetails`. A
função é pura, montada no submit com tudo menos o protocolo, e chamada dentro da transação
depois de gerado o número. O resultado entra em `details.signature` no mesmo `insert`.

- *Alternativa: inserir e depois dar `update` com a assinatura.* Recusada. Abriria uma janela
  em que o pedido existe sem assinatura, e uma falha no meio deixaria exatamente o pedido que
  esta change quer eliminar.
- *Alternativa: gerar o protocolo antes, fora da transação.* Recusada. A sequência sem colisão
  sob concorrência depende de ela estar onde está.

### D4. A via eletrônica é gerada da cópia, não dos dados atuais

`buildRequerimento` passa a aceitar a assinatura. Quando ela existe, as linhas de requerente e
de pedido saem de `signature.content`, o subtítulo usa `signedAt`, e `signature` (o parágrafo
de instrução) dá lugar a `stamp`. Os dados da serventia (timbre, nome, contatos, rodapé) saem
do tenant atual: apresentação não é conteúdo assinado. "Gerar sem assinatura" no painel chama
`buildRequerimento` sem a assinatura e imprime os dados atuais, com o parágrafo de instrução,
para quem quer a folha limpa.

- *Alternativa: imprimir os dados atuais com uma linha "corrigido após a assinatura".*
  Recusada. Um documento assinado que muda de conteúdo deixa de ser o que foi assinado. A
  correção é ato da serventia e já vive no histórico.

### D5. Um carimbo, dois documentos

O tipo `DeclaracaoStamp` vira `CertificationStamp` (heading, badge, facts, paragraphs, hash,
ip, motto), e `drawStamp` sai de `pdf-form.ts` para `pdf-primitives.ts`, onde os dois
renderizadores o alcançam. `renderDocuments` (`pdf.ts`) desenha o carimbo no lugar do bloco
de assinatura quando o documento traz `stamp`. A declaração não muda de aparência.

Texto do carimbo do requerimento (constantes em `src/core/acts/catalog.ts`, ao lado das da
declaração):
- heading: "Assinatura eletrônica"
- badge: "Emitida pela plataforma"
- facts: "Assinado por" (nome digitado), "Assinado em", "Canal" ("Site da serventia"),
  "Protocolo"
- paragraphs: `SIGNATURE_STATEMENT` ("Requerimento assinado eletronicamente pela pessoa
  requerente na Plataforma Eletrônica Oficial da Serventia, mediante revisão do conteúdo acima
  e digitação do nome completo."), seguido de `PLATFORM_STATEMENT` (que já cita o art. 208, II,
  "b" do CNN-CNJ para o canal).
- hash e IP, como na declaração.

Não cita a Lei 14.063/2020 nem outra norma sobre a validade da assinatura: é a Open Question
1. Um teste no catálogo impede que o texto do carimbo do requerimento mencione "14.063" ou
"assinatura eletrônica simples" enquanto a serventia não indicar o fundamento. É o mesmo
mecanismo que hoje impede a frase sobre o Provimento 7/2026.

### D6. "Revise e assine" mostra o que o PDF vai imprimir

O bloco renderiza em HTML as seções de `buildRequerimento` montadas no cliente com os valores
do formulário e o protocolo como "atribuído no envio". `requerimento.ts` não importa
`node:crypto`. O hash fica em `signature-hash.ts` (servidor), e o cliente importa só
`signature.ts` (normalização) e `requerimento.ts`.

- *Alternativa: um resumo próprio da tela.* Recusada. Seriam dois textos para manter iguais, e
  a pessoa poderia ler um e assinar outro.

Na gratuidade, o bloco "Revise e assine" vem depois do aceite da declaração, que não muda.

### D7. Quem lê "tem requerimento assinado" passa a considerar a assinatura eletrônica

Uma função pura no core, `requerimentoSignedState(details, attachments)`, devolve
`{ kind: "attached", attachment } | { kind: "electronic", signedAt } | { kind: "missing" }`.
O anexo mais recente prevalece sobre a assinatura eletrônica. Consulta (`protocolo/actions.ts`,
`hasSignedForm` e `signedFormReceivedAt`), acompanhamento (`protocol-trilho.tsx`, "Falta só a
sua assinatura."), cabeçalho do detalhe no painel e `admin-overview.ts` (último contato do
cidadão) passam a ler essa função, sem cada um reinterpretar `details`.

No overview, a assinatura eletrônica não conta como "contato do cidadão" depois da criação: ela
acontece no mesmo instante do pedido.

### D8. O envio pelo Gov.br continua, escondido

A tela de sucesso de um pedido assinado não oferece o envio do requerimento. A consulta
oferece, recolhido sob "Prefere assinar pelo Gov.br?", o mesmo `SignedFormUpload` de
`documento="requerimento"`. `attachSignedForm` não muda. Pedidos sem `details.signature`
continuam com a tela e a consulta de hoje.

### D9. Abrir a via eletrônica pelo painel deixa a mesma auditoria

Abrir a via eletrônica registra `service-request.print.requerimento-assinado`, a mesma ação
de abrir a via anexada, com `source: "electronic"` no lugar do id do anexo. O histórico do
pedido mostra "Requerimento assinado impresso" nos dois casos.

## Risks / Trade-offs

- [A pessoa digita o nome com abreviação ("Maria S. Silva") e é recusada] → A mensagem de erro
  mostra o nome do requerente como foi preenchido acima e diz para digitá-lo igual. A
  conferência já relaxa caixa, acentos e espaços. Se a recusa virar atrito real, dá para
  tolerar diferença de partículas ("da", "de", "dos") depois, sem mudar o que é gravado.
- [A serventia não aceitar a redação do carimbo] → A redação é constante versionada em
  `catalog.ts`. Trocá-la não muda o hash, porque o texto do carimbo não entra no conteúdo
  assinado, só o texto das declarações.
- [Mudar `REQUERIMENTO_DECLARATIONS` mexe nos hashes] → Versão nova (`textVersion: "2"`) com o
  texto novo. A versão 1 fica no código enquanto existir pedido assinado com ela.
- [A cópia guarda um CPF que a serventia corrigiu] → É a prova do que foi assinado. Fica sob a
  retenção e o acesso do pedido, e o painel não exibe a cópia além do aviso de diferença.
- [Bundle do cliente cresce com `requerimento.ts` e o catálogo] → O formulário já importa
  constantes do catálogo. Conferir o tamanho do chunk de `/solicitar` antes e depois.
- [Formulário aberto antes do deploy envia sem o nome digitado] → O servidor recusa com erro
  no campo, que não existe na página velha. A mensagem geral pede para recarregar a página.
  Acontece só na janela do deploy.

## Migration Plan

Sem migração de banco: `details` é JSONB e `signature` é aditivo. Deploy único. Rollback:
reverter o código. Pedidos criados com assinatura continuam válidos depois de um rollback (o
código antigo ignora `details.signature`), só passam a pedir o envio pelo Gov.br de novo na
consulta.

Antes do merge, `via-assinada-no-painel` precisa estar arquivada, para os deltas desta change
caírem sobre o texto dela.

## Open Questions

1. **O que o carimbo pode afirmar, e com qual fundamento?** (serventia) Hoje ele descreve os
   fatos e cita só o art. 208, II, "b" do CNN-CNJ para o canal. Ele pode chamar a assinatura de
   "assinatura eletrônica simples" e citar a Lei 14.063/2020, art. 4º, I? Ou outra norma
   indicada pelo oficial? Até a resposta, o teste de D5 impede a citação.
2. **O CPF passa a ser obrigatório no pedido pelo site?** (serventia) Hoje é opcional. A
   assinatura simples precisa permitir identificar quem assinou, e o pedido tem nome, um e-mail
   não confirmado e IP. Se a resposta for sim, é uma regra a mais em `publicServiceRequestSchema`.
   O desenho acima não depende dela.
3. **Atos em que a assinatura simples não basta?** Se a serventia apontar algum (por exemplo,
   um ato que exija firma reconhecida ou assinatura avançada), o catálogo ganha um marcador por
   ato e esses atos voltam ao fluxo do Gov.br. Por ora, vale para todos os atos do site.
