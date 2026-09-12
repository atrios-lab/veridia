## Context

A declaração de hipossuficiência é hoje um `RequerimentoDocument` montado por `buildDeclaracao`
em `src/core/request/declaracao.ts` e desenhado por `renderDocuments` em `src/lib/pdf.ts`, o
mesmo renderizador do requerimento e do comprovante: timbre, eyebrow, título, seções com
`rows`, `fields` (rótulo em cima, linha embaixo) e `paragraphs`, assinatura no pé, rodapé de uma
linha. Caixas de marcação saem como `[X]`/`[ ]` porque as fontes base não têm ☒/☐. Três rotas
chamam `buildRequestDocuments` (`src/lib/request-documents.ts`) e passam o resultado a
`renderDocuments`; a rota do formulário em branco chama `buildDeclaracoes` sem `exemption`.

O Design3.pdf, aprovado pela serventia, é outro objeto: cartões numerados com cabeçalho tingido,
campos em grade de duas ou três colunas, caixas de marcação vetoriais, avisos destacados, um
cabeçalho compacto na página 2, "Nº do pedido" no timbre, "Página X de Y" no rodapé, e um
carimbo de certificação no fim. Duas ressalvas foram decididas ao aprovar: a linha "Aceite
eletrônico registrado em…" que o design pôs dentro do bloco 5 **não** é gerada (o bloco 5 fica
como o oficial, e o aceite vive só no carimbo), e o tipo de certidão sai como "Sem busca", não
"Breve relato (sem busca)". As variações do balcão e em branco não foram desenhadas: são o mesmo
layout com dados diferentes.

Fatos de código que pesam: `details.exemption` é jsonb validado só por Zod, aditivo; o canal do
pedido já está em `details.channel` (`counter`, `chat`; ausente = site); o instante do aceite já
está em `exemption.declaredAt`; o IP não é gravado em lugar nenhum, mas `src/lib/rate-limit.ts`
já lê o primeiro salto de `x-forwarded-for`; `src/core/request/access-key.ts` já usa
`node:crypto` no core, então hash no core não é novidade; `tenant.cns` existe mas o Anexo I não o
pede.

## Goals / Non-Goals

**Goals:**
- O PDF sai como o Design3, com o conteúdo do Anexo I oficial, nas três situações (site, balcão,
  em branco), sem que o core saiba de PDF.
- O carimbo afirma só o que o sistema sabe com verdade, e o que afirma é conferível: hash
  recalculável a partir do pedido, IP gravado no aceite.
- O requerimento e o comprovante não mudam nem de código nem de aparência.

**Non-Goals:** os do proposal (anexo congelado, via assinada, texto no site, user agent, CNS,
fonte embutida, "outro ato" como alvo).

## Decisions

### 1. Um tipo de documento próprio para o formulário, e não mais campos no `RequerimentoDocument`

`buildDeclaracao` passa a devolver `DeclaracaoDocument`:

```
DeclaracaoDocument {
  kind: "declaracao"
  letterhead: { office: string[]; annex: string; protocolNumber?: string }
  eyebrow: string; title: string
  continuation: { title: string; subtitle: string }     // cabeçalho da página 2+
  notice: { heading: string; text: string }              // "Antes de preencher"
  blocks: FormBlock[]                                    // os nove
  dataProtection: string                                 // aviso entre 5 e 6
  stamp?: Stamp                                          // só com pedido
  legalBasis: string                                     // base normativa oficial
  footer: string[]                                       // 1 linha em branco, 2 com pedido
}
FormBlock {
  number: number; heading: string; hint?: string         // "Somente se houver"
  content: FormContent[]
}
FormContent =
  | { type: "fields"; columns: FormField[] }             // uma linha da grade, 1 a 3 campos
  | { type: "checklist"; items: { checked: boolean; label: string; detail?: string;
        sub?: { checked: boolean; label: string }[] }[] }
  | { type: "paragraph"; text: string; emphasis?: boolean }
  | { type: "list"; items: string[] }                    // ciências a–e
  | { type: "signature"; label: string; value?: string } // linha de assinatura
  | { type: "fingerprint"; text: string }                // quadrado tracejado do bloco 7
  | { type: "aside"; heading: string; fields: FormField[] } // Livro/Folha/Termo à direita
FormField { label: string; value?: string; width?: 1 | 2 | 3 }  // fração da linha
Stamp {
  heading: string; badge: string
  facts: { label: string; value: string }[]              // canal, recebida em, formalizada por, protocolo
  paragraphs: string[]
  hash?: string; ip?: string                             // ausentes imprimem linha em branco
  motto: string
}
```

Alternativa: estender `RequerimentoSection` com colunas, caixas e cartão. Descartada: o
requerimento ganharia vocabulário que nunca usa, e cada novo `?:` no tipo compartilhado é um
caminho a mais para o renderizador antigo errar. O formulário é outro documento; ganha outro
tipo. `renderDocuments` passa a aceitar `(RequerimentoDocument | DeclaracaoDocument)[]` e
despacha por `kind` (o `RequerimentoDocument` ganha `kind: "requerimento"` com default para não
tocar os construtores existentes).

### 2. Renderizador novo em `src/lib/pdf-form.ts`, reaproveitando timbre, QR e rodapé de `pdf.ts`

`pdf.ts` exporta `drawLetterhead`, `drawFooter`, `makeQr` e as constantes de margem. `pdf-form.ts`
desenha o resto: cartão (`roundedRect` com `palette.border`, faixa de cabeçalho em
`palette.surface`, badge circular em `palette.primary` com o número em branco), grade de campos
(largura útil dividida pelas frações dos `width`), caixa de marcação (quadrado 9 pt com borda
`NEUTRALS.text`, marcado com "X" em Helvetica-Bold 7 pt centrado), aviso (`roundedRect` em
`palette.accentSoft` para "Antes de preencher" e em `palette.surface` para "Proteção de dados",
com um glifo simples à esquerda), quadrado tracejado (`dash`), carimbo (cartão com borda dupla
em `palette.primary`, badge à direita, quatro fatos em duas linhas, parágrafos, linha de hash em
Courier 7 pt e IP, lema em versalete espaçado).

Fontes: Times-Bold para o título do documento e os cabeçalhos dos blocos, Helvetica para todo o
resto, Courier para o hash. As três são base-14: nada é embutido, o arquivo continua pequeno e
o design fica reconhecível. Alternativa: embutir a serifada do design. Descartada por peso e por
licença; Times é o que o pdfkit já tem.

Quebra de página: um bloco nunca é dividido. Antes de desenhar cada bloco, mede-se a altura (os
blocos têm conteúdo fixo, a medição é `heightOfString` sobre o texto) e, se não cabe, abre nova
página com o cabeçalho de continuação. O carimbo segue a mesma regra. O design mira duas páginas
na versão preenchida e isso deve sair naturalmente com as medidas do Design3 (bloco 4 é o mais
alto, cerca de 170 pt); não é garantia dura.

"Página X de Y": `bufferPages: true` no `PDFDocument` e uma passada final que escreve o rodapé em
cada página com o total. O `pageAdded` deixa de desenhar o rodapé para os documentos de formulário;
para os demais continua como está.

### 3. Conteúdo segue o Anexo I oficial, e o Design3 só onde o oficial não fala

Onde o design e o DJe divergem, ganha o DJe. Concretamente, nos textos do core:

- Bloco 3: quatro itens na letra oficial ("Certidão de nascimento, casamento, óbito ou outra",
  "Habilitação, registro do casamento e primeira certidão", "Alteração extrajudicial de prenome
  e gênero (Retificação e Averbação), inclusive certidões correspondentes", "Outro ato com
  previsão legal"), sem base legal ao lado; tipo da certidão "Sem busca"/"Com busca"/"Inteiro
  teor"; "Descreva o ato e a finalidade (se necessário)" sempre em branco quando gerado do
  pedido. O mapeamento do catálogo para o item marcado é por `feeExemption` do ato-alvo
  (`rcpn-certidao` → item 1, `rcpn-habilitacao-casamento` → item 2, `rcpn-alteracao-prenome` →
  item 3); "Outro" nunca marca.
- Avisos "Antes de preencher" e "Proteção de dados": texto oficial, não a paráfrase do design.
- Bloco 5: "Local, data e assinatura da pessoa interessada", com "Local e data" e a assinatura;
  sem a linha do aceite eletrônico.
- Blocos 6, 7 e 9: as frases fixas do oficial ("Declaro que atuo em nome ou em assistência…",
  "A pedido da pessoa beneficiária, assino a presente declaração a rogo.", "Certifico e dou fé
  que as assinaturas e/ou a impressão digital foram apostas em minha presença…").
- Bloco 8: nome, CPF ou RG, telefone ou e-mail por testemunha; sem linha de assinatura.
- Base normativa: a linha do DJe, na ordem do DJe, como constante `ANEXO_I_LEGAL_BASIS` no
  catálogo. Sai igual no formulário em branco e no preenchido.

Os textos vão para `src/core/acts/catalog.ts`, ao lado de `FEE_EXEMPTION_DECLARATION`, como
constantes nomeadas e testadas: o conteúdo oficial é regra de negócio, não detalhe de desenho.

Blocos 6 e 7 continuam condicionais (aparecem só quando `signedBy` pede) na versão gerada do
pedido, e aparecem sempre no formulário em branco, como no oficial. O bloco 8 aparece sempre.

### 4. O carimbo lê o que o banco já tem, mais o IP; não inventa

`buildStamp(tenant, stored, exemption)` em `request-documents.ts` (é o único lugar que vê o
`stored` inteiro) monta:

- Canal: `details.channel` ausente → "Site oficial da serventia"; `counter` → "Balcão";
  `chat` → "Atendimento por chat".
- Recebida em: `exemption.declaredAt` formatado "dd/mm/aaaa às HH:MM" no fuso `America/Fortaleza`
  (RN não tem horário de verão e o tenant não tem fuso configurável; se um dia tiver, entra por
  ali).
- Formalizada por: `signedBy` do beneficiário da página: "A própria pessoa", "Representante
  legal: <nome>", "A rogo: <nome>".
- Protocolo: `stored.protocolNumber`.
- Hash: `acceptanceHash(...)` (decisão 5).
- IP: `exemption.acceptance?.ip`; ausente (pedido antigo, balcão) imprime a linha em branco.
- Parágrafos: o texto de recebimento ("Declaração recebida eletronicamente pela Plataforma
  Eletrônica Oficial da Serventia, mediante aceite do texto integral do Anexo I do Provimento
  CGJ/TJRN nº 7/2026 pela pessoa beneficiária.") e o texto institucional da plataforma (art. 208,
  II, "b" / Provimento 180/2024), como constantes `PLATFORM_STATEMENT` no core.

O carimbo cita o Provimento 180 para o canal e o Provimento 7 para o conteúdo; **não** diz que o
Provimento 7 autoriza a plataforma, porque ninguém confirmou um artigo que diga isso.

No balcão o carimbo ainda sai: canal "Balcão", data do lançamento, IP em branco. Ele continua
útil ao fundo (protocolo, quem formalizou, hash), e a prova do aceite presencial é o papel
assinado, que o bloco 9 certifica.

### 5. Hash do conteúdo aceito, calculado no core, determinístico

`acceptanceHash(input)` em `src/core/request/acceptance.ts`: SHA-256 (`node:crypto`, já usado
no core) sobre a serialização canônica (chaves ordenadas, sem espaços, UTF-8) de
`{ tenantSlug, protocolNumber, declaredAt, actId, certificateType, beneficiaries (sem
`witnesses` e sem `decision`), declaration: FEE_EXEMPTION_DECLARATION, acknowledgements:
FEE_EXEMPTION_ACKNOWLEDGEMENTS }`. Imprime os 64 hex em Courier 7 pt, cabe numa linha.

Por que não o hash dos bytes do PDF: o PDF não pode conter o próprio hash, e é regenerado a cada
download (a marca do tenant pode mudar). O que o fundo precisa conferir é que o *conteúdo* que a
pessoa aceitou é o que está no papel; o hash cobre exatamente isso, e quem tem o pedido recalcula.
Incluir o texto da declaração no hash é o que amarra o aceite à redação em vigor na época: se o
catálogo mudar o texto amanhã, o hash de um pedido antigo deixa de bater com o papel novo, o que
é a verdade. (Por isso `declaredAt` e o protocolo entram: o mesmo conteúdo em dois pedidos dá dois
hashes.) Testemunhas ficam de fora porque são colhidas no balcão depois do aceite; `decision`
fica de fora porque é do oficial, não da pessoa.

Alternativa: assinar com HMAC e uma chave do servidor. Descartada: o fundo não tem a chave; um
hash público que qualquer um recalcula é mais conferível do que uma assinatura que só o veridia
verifica.

### 6. IP gravado só no aceite da gratuidade, pelo site

`src/lib/client-ip.ts` exporta `clientIp(headers)` (primeiro salto de `x-forwarded-for`, ou
`undefined`), extraído de `rate-limit.ts`, que passa a usá-lo. Em `solicitar/actions.ts`, quando
`exemption` existe, `buildExemptionDetails` recebe `acceptance: { ip }`. Schema em `kinds.ts`:
`acceptance: z.object({ ip: z.string().optional() }).optional()`. O balcão não passa `acceptance`.

Só a gratuidade: a finalidade declarada no proposal é comprovar o aceite da declaração perante o
fundo; os aceites de LGPD e veracidade do requerimento não têm esse auditor e não ganham IP.
Alternativa: gravar em todo pedido, "já que está ali". Descartada pela finalidade: dado pessoal
sem uso declarado.

### 7. O formulário em branco é o mesmo documento com `exemption` ausente

`buildDeclaracao(tenant, act, undefined, 0)` devolve o documento com todos os `value` ausentes,
sem `stamp`, com `letterhead.protocolNumber` ausente (o timbre desenha a linha de "Nº do pedido"
em branco) e `footer` de uma linha. Os blocos 6 e 7 aparecem. A rota
`/solicitar/declaracao-hipossuficiencia` não muda.

## Risks / Trade-offs

- [Um renderizador de formulário novo é muita geometria para conferir por teste unitário] → O
  conteúdo (textos, ordem, marcações, carimbo) é testado no core sem PDF; o desenho é conferido
  visualmente contra o Design3 numa tarefa de fechamento, nas três variações, com o PDF aberto
  no navegador.
- [Times-Bold não é a serifada do design] → É a mesma família tipográfica e o mesmo peso; a
  serventia aprovou o layout, não a fonte. Se a diferença incomodar, embutir fonte é uma tarefa
  isolada no renderizador.
- [Quebra de página pode empurrar o carimbo para uma terceira página em pedidos com bloco 6 ou 7]
  → Aceitável: o bloco 8 e o 9 já são curtos e o carimbo cabe com eles. Se a terceira página
  virar regra, o cabeçalho de continuação já resolve a leitura.
- [`x-forwarded-for` pode ser forjado por quem chama direto] → Na Vercel o primeiro salto é
  escrito pela borda; fora dela, o rate limit já confia na mesma leitura. O IP é evidência a mais,
  não a única.
- [Pedidos antigos sem IP imprimem linha em branco] → É a verdade: nada foi gravado. O carimbo
  continua afirmando canal, data, formalização e hash.
- [Hash muda se a redação de `FEE_EXEMPTION_DECLARATION` mudar] → É intencional (decisão 5), e é
  o que faz o hash servir de prova; documentar no comentário da constante que mudar o texto
  invalida a conferência dos hashes antigos, e que uma mudança de redação deve vir com
  versionamento do texto.

## Migration Plan

Deploy único, sem banco. `acceptance` é opcional e `readExemption` já normaliza o que falta.
Rollback é reverter o deploy: pedidos com `acceptance` gravado continuam válidos para o schema
antigo, que ignora chaves desconhecidas? Não: `exemptionSchema` é `z.object` sem `.strict()`,
então chaves extras passam. Confirmar no teste de `kinds.test.ts` (tarefa 2.3).

## Open Questions

- O rótulo do canal `chat` ("Atendimento por chat") é o único que não está no Design3; se a
  serventia preferir tratá-lo como "Balcão", é uma linha no mapeamento.
- Se o fundo pedir o hash dos bytes do arquivo, e não do conteúdo, a resposta é o anexo
  congelado (non-goal), não este carimbo.
