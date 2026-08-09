## Context

Hoje há um único renderizador de PDF, `renderDocument` em `src/lib/pdf.ts` (~50 linhas de PDFKit),
alimentado por um modelo puro montado em `src/core/request/requerimento.ts`. Esse modelo
(`RequerimentoDocument`: título, linhas da serventia, seções de rótulo/valor ou parágrafos,
assinatura, rodapé) serve dois documentos: o requerimento do pedido de serviço e o recibo do
Encarregado (LGPD). A separação está certa — a redação é testável sem PDF — e não vale a pena mexer nela.

O que está errado é o desenho e a colocação da credencial:

- O renderizador não conhece a serventia. Ele desenha Helvetica preta em A4, sem logotipo e sem cor.
- `buildRequerimento` empilha `Chave de acesso` como uma linha qualquer da seção "Pedido", ou seja,
  no meio da folha que o cidadão assina e devolve pelo site.

As cores dos temas existem só em `src/app/globals.css`, como `--palette-<tema>-<token>`. PDFKit não
lê CSS.

## Goals / Non-Goals

**Goals:**
- O requerimento sai na paleta e com o logotipo do tenant, com a mesma estrutura para todas as serventias.
- Protocolo e chave saem do corpo e vão para a última página, destacável.
- O recibo LGPD herda o visual sem mudar onde suas credenciais aparecem.
- O modelo continua puro e testável sem gerar PDF.

**Non-Goals:**
- Trocar PDFKit, renderizar via HTML/headless, ou embutir fontes personalizadas.
- Senha, criptografia ou marca d'água no arquivo.
- Mudar texto legal, campos, rotas ou o contrato HTTP.
- Reescrever o design system ou o pipeline de tema do site.

## Decisions

### 1. A credencial vira um campo do modelo, não uma linha de tabela

`RequerimentoDocument` ganha:

```ts
interface RequerimentoCredentials {
  heading: string;
  rows: RequerimentoRow[];   // Protocolo, Chave de acesso
  note: string;              // por que está separada e o que fazer com ela
}
```

`credentials?: RequerimentoCredentials` — opcional. `buildRequerimento` preenche e remove
`Protocolo`/`Chave de acesso` da seção "Pedido". `buildDataRightsReceipt` não preenche: seu recibo
não é assinado nem devolvido, então as credenciais seguem no corpo, onde o titular as lê.

*Alternativa descartada:* um flag `credentialsOnLastPage: boolean` no renderizador, lendo as linhas
por rótulo. Acopla desenho a texto em português e quebra silenciosamente se o rótulo mudar.

*Alternativa descartada:* dois arquivos PDF (requerimento + comprovante). Dobra as rotas, o download
e a explicação na tela de sucesso, para resolver o mesmo problema que uma página destacável resolve.

### 2. A página de credenciais é uma `addPage()` explícita, sempre a última

Depois do rodapé do corpo, se `credentials` existir, o renderizador chama `pdf.addPage()` e desenha
um cartão único e centralado: título, protocolo e chave em corpo grande e monoespaçado (Courier —
já embutido no PDFKit, e a chave tem hífens e caracteres que se confundem em proporcional), e a nota.
Nada mais entra nessa página, porque é ela que se destaca.

O protocolo continua impresso no corpo e no rodapé (é identificador, não credencial); só a chave sai.

### 3. A paleta ganha um espelho em TypeScript, com teste que trava a divergência

Novo `src/core/tenant/palette.ts`:

```ts
export const PALETTES: Record<Theme, Record<PaletteToken, string>> = { ... }
```

com os tokens que o PDF usa (`primary`, `shade`, `accent`, `accent-soft`, `surface`, `border`,
`muted`, e os compartilhados `text`, `text-soft`). `src/app/globals.css` continua sendo a referência
do site.

O princípio "nenhum hex fora de `@theme`" existe para impedir cor solta em componente. Aqui a
duplicação é inevitável — PDFKit não lê CSS e Tailwind v4 é CSS-first, então não há como gerar o
`@theme` a partir do TypeScript sem inventar um passo de build. A defesa é um teste
(`src/lib/palette.test.ts`, `node --test`) que lê `globals.css`, extrai os `--palette-*` por regex e
compara com o mapa, nos dois sentidos. Se alguém ajustar um verde no CSS e esquecer do PDF, o teste
falha. O teste mora em `src/lib/`, não ao lado do módulo: `src/core` é domínio puro e o Biome barra
`node:fs` lá dentro — a regra está certa e não é o caso de afrouxá-la por um teste.

`scripts/check-tokens.mjs` ganha `palette.ts` na lista de exceções, com o motivo escrito. É a única
brecha, e o teste acima é o que a torna segura.

*Alternativa descartada:* ler `globals.css` em runtime no servidor. Elegante no repositório, frágil
na Vercel — depende do arquivo ser incluído no rastreamento do bundle, e falha em produção, não no CI.

*Alternativa descartada:* mover os hexes para TypeScript e gerar o CSS. Um passo de build novo para
cinco temas que mudam quase nunca.

### 4. `renderDocument` passa a receber a marca, não o tenant

```ts
renderDocument(document: RequerimentoDocument, brand: DocumentBrand): Promise<Buffer>
```

com `DocumentBrand = { palette: Palette; logoPath?: string }`, montado por um helper em `src/lib/`
a partir do tenant. Assim `src/lib/pdf.ts` não importa o schema do tenant nem sabe o que é uma
serventia — continua sendo só desenho.

O logotipo é o `logos.light` do tenant (PNG em `public/`), lido do disco com `node:fs` e passado a
`pdf.image()`. Se o arquivo não existir ou não abrir, o cabeçalho sai só com o nome da serventia:
um logotipo faltando não pode derrubar o download de um requerimento.

### 5. O que "bonito" quer dizer, concretamente

Papel timbrado claro, seguindo a referência aprovada pelo usuário (um requerimento gerado no
redesign anterior): a cor entra pela tipografia e pelos detalhes, não por uma faixa de tinta.
PDFKit continua empilhando na vertical, o que já funciona. O desenho:

- Cabeçalho branco: selo redondo da serventia (`logos.seal.light`) à esquerda, nome em `primary`
  com as linhas institucionais em `muted`, e à direita um QR code apontando para a consulta do
  protocolo (`/protocolo` no host do próprio pedido), com régua `border` fechando o bloco.
- Eyebrow ("SERVIÇOS ON-LINE") em `accent`, caixa alta espaçada; título grande em `text`; logo
  abaixo, a linha `Protocolo X · data` — protocolo e data saem das linhas do corpo e viram esse
  subtítulo, que é onde o olho procura.
- Cabeçalho de seção no mesmo tom do eyebrow: `accent`, caixa alta, espaçado.
- Linhas rótulo/valor com o rótulo em `muted` e o valor em `text` — colunas alinhadas com fio
  `border` entre valores, não `"Rótulo: valor"` em texto corrido.
- Rodapé em `muted`, com régua `border`, repetido em todas as páginas via o evento `pageAdded`.

O QR exige a dependência `qrcode` (server-side, sem transitivas pesadas): codificar QR não é
"algumas linhas". O QR sai na tinta do tema (`primary` sobre branco), que é escura o bastante
para qualquer leitor.

Fontes seguem as Standard 14 do PDFKit (Helvetica/Courier). Embutir a serif do tema (Spectral e
companhia, hoje via `next/font`) exigiria carregar TTFs no servidor: fica de fora, e o documento
mantém a cor da marca sem a tipografia dela.

## Risks / Trade-offs

- **A paleta duplicada em TS diverge do CSS** → teste `palette.test.ts` compara os dois e falha no CI.
- **Quem já baixou um requerimento antigo tem a chave na página 1** → nada a fazer sobre arquivos já
  emitidos; a mudança vale para os próximos downloads, e o mesmo protocolo baixado de novo sai no
  formato novo.
- **O cidadão anexa o PDF inteiro, com a página de credenciais junto** → a página se explica e a
  tela de sucesso reforça, mas o risco não vai a zero. O ganho real é que agora dá para não anexar;
  hoje não dá.
- **Logotipo pesado inflando o arquivo** → PDFKit reencaixa o PNG como está; os logos atuais são
  pequenos. Se um tenant subir um PNG de vários MB, o requerimento fica grande. Aceito por ora.
- **O visual quebra em ato com muitos documentos esperados** → o corpo continua fluindo em várias
  páginas; a régua de rodapé e o cabeçalho repetido são o que garante que a página 2 não pareça órfã.
- **Testes do modelo que procuram a chave no corpo passam a falhar** → é o comportamento desejado;
  os testes mudam junto, procurando em `credentials`.

## Migration Plan

Deploy único. Sem migração de banco, sem mudança de contrato HTTP, sem alteração no armazenamento da
chave. Rollback é reverter o commit: os PDFs voltam ao formato anterior e nada persistido depende do
formato.

## Open Questions

- A tela de sucesso deve dizer em uma linha "a última página é seu comprovante, não anexe"? Fica de
  fora desta mudança (é microcopy da tela, não do PDF), mas é o complemento natural.
