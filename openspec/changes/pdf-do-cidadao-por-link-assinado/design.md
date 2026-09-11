## Contexto

Seis forms do site público (`request-form.tsx`, `protocol-lookup.tsx`, `protocol-trilho.tsx`)
fazem POST em `/solicitar/requerimento` com `target="_blank"`. A rota verifica a chave e responde
`application/pdf`, `Content-Disposition: inline`, `Cache-Control: private, no-store`. A aba nova
mostra o PDF no visualizador do Chrome com a URL `/solicitar/requerimento`.

O botão de download desse visualizador não salva os bytes carregados: no Chromium, salvar o
"original" dispara um download novo da URL do documento, e um download é sempre GET. Com a
resposta vinda de um POST, não há entrada no cache HTTP que sirva a um GET (com ou sem
`no-store`), e a requisição chega ao servidor, que responde 405 porque a rota só exporta `POST`.
O Chrome mostra "O site não está disponível"; "Retomar" repete o GET. Reproduzido no dev server:

```
GET  /solicitar/requerimento  -> 405
POST /solicitar/requerimento  -> 404 (chave errada, como esperado)
```

Imprimir usa o que está na aba e funciona. Firefox (pdf.js) e Safari salvam do que carregaram.
No painel, `imprimir/route.ts` é GET com cookie e não sofre disso.

## Decisão: POST verifica a chave e redireciona para um GET assinado de curta duração

```
form POST /solicitar/requerimento        (protocolo + chave no corpo, como hoje)
        │
        ▼
verifica chave ─── errada/inexistente ──► 404 (sem distinguir)
        │
        ├── documento=comprovante ──► 200 application/pdf, attachment  (ver abaixo)
        │
        └── requerimento | declaracao
                │
                ▼
        303 Location: /solicitar/requerimento/declaracao-REQ.2026.000295.pdf?t=<token>
                │
                ▼   (a aba nova segue o redirect; é essa URL que fica na barra)
        GET [arquivo]/route.ts: token válido ──► 200 application/pdf, inline
                                token inválido/expirado/outra serventia ──► 404
                │
                ▼
        visualizador do Chrome: ⬇ refaz o GET da mesma URL ──► 200, mesmo PDF
```

Os forms não mudam. A chave continua indo no corpo do POST, nunca em URL. O que vai para a URL
da aba é um token que só serve para aquele documento, daquele pedido, daquela serventia, por uma
hora.

### O token

Pura função em `src/core/request/pdf-link.ts`, sem I/O, com o segredo passado como parâmetro
(mesmo padrão de `access-key.ts` e `webhook-auth.ts`):

```
payload   = base64url(JSON { t: tenantSlug, p: protocolNumber, d: "requerimento"|"declaracao", e: expiresAtEpochSeconds })
signature = base64url(HMAC-SHA256(key, "pdf-link:v1." + payload))
token     = payload + "." + signature
```

- **Sem banco.** Verificar é recomputar o HMAC e comparar em tempo constante
  (`timingSafeEqual`), depois checar `e` contra o relógio e `t` contra o tenant do host. Só
  então a rota vai ao banco buscar o pedido. Um token forjado não custa uma consulta.
- **Segredo derivado de `BETTER_AUTH_SECRET`**, com rótulo de propósito
  (`HMAC(BETTER_AUTH_SECRET, "veridia:pdf-link")`) para que um vazamento de token nunca diga nada
  sobre sessões, e vice-versa. Uma variável própria seria mais limpa, mas a configuração de
  ambiente na Vercel é manual (produção e Preview) e é o tipo de passo que fica faltando num
  deploy; a derivação evita o passo. Se um dia houver rotação, a chave derivada gira junto.
- **Validade de uma hora.** O cidadão abre a aba e salva no mesmo minuto; uma hora cobre ler,
  conferir e decidir. Mais que isso é uma URL no histórico do navegador que serve um PDF com
  nome, CPF e endereço para quem tiver o histórico. Expirou: a aba já aberta continua mostrando
  o PDF (já está carregada), só o botão de baixar falha, e o caminho de volta é clicar de novo no
  site, que emite outro link. Vale revisitar se o cartório relatar o contrário.
- **Amarrado ao tenant.** `t` vai no payload e é comparado com `getTenant()` do host. O mesmo
  deploy serve N serventias; sem isso um link emitido no domínio de uma abriria no de outra.
- **Amarrado ao documento.** `d` é fechado (`requerimento` | `declaracao`); o comprovante não
  entra no conjunto por construção, não só por validação.

### O comprovante vira `attachment`

O comprovante carrega a chave impressa e o servidor só guarda o hash: para servi-lo por GET a
chave teria de viajar dentro do token, e aí a URL do histórico seria a credencial, mesmo cifrada.
Então o comprovante continua respondendo ao POST, mas como `Content-Disposition: attachment`:
o navegador salva na hora, não abre visualizador, não há refetch. Com `target="_blank"` o Chrome
abre a aba e a fecha sozinho ao ver que a resposta é um download; a tela da chave fica intacta,
que era o ponto da change #90. É o documento que o cidadão precisa guardar de qualquer forma, e
a tela já diz isso.

### O comprovante do painel segue o mesmo caminho

O painel tem um único POST que serve PDF: o comprovante reemitido em `imprimir/route.ts`, chamado
pela seção da chave do detalhe (`key-section.tsx`) e pelo lançamento manual
(`manual-entry-form.tsx`, no "Imprimir os dois"). A chave em claro só existe na resposta da ação
que a emitiu, então vale o mesmo raciocínio do comprovante público: não há token possível, e a
resposta vira `attachment`.

Para o operador isso troca "abre na aba, imprime dali" por "salva, abre o arquivo, imprime": um
clique a mais, em troca de o arquivo poder ser guardado e enviado. O rótulo acompanha: "Baixar
comprovante (PDF)" no lugar de "Imprimir comprovante", e no lançamento manual o estado do
comprovante passa a dizer "baixado" em vez de "enviado para impressão", porque é o que a tela
consegue afirmar. O `printBoth` fica mais simples, não mais complexo: o download não abre aba,
então só o `window.open` do requerimento disputa o gesto do clique, e o bloqueio de pop-up que
o código hoje trata continua sendo só dele.

Os demais documentos do painel (requerimento, declaração, em branco, anexos) já são GET com cookie
de sessão e não mudam.

### Nome do arquivo e título da aba

Hoje a aba diz "requerimento" para a declaração: o Chrome usa o último segmento da URL quando o
PDF não tem `Title`. Duas correções baratas que a mudança de rota torna naturais:

- o link termina em `<documento>-<protocolo>.pdf`, então o segmento da URL já é o nome certo;
- `renderDocuments` passa `info: { Title }` ao `PDFDocument` com o título do primeiro documento,
  e o visualizador mostra "Declaração de hipossuficiência econômica" em vez do segmento.

O segmento `[arquivo]` é decorativo: a rota lê tudo do token e monta o `filename` do
`Content-Disposition` a partir dele, não do path. Um segmento que não bate com o token não é
erro, é ignorado.

### Alternativas descartadas

- **`attachment` em todos os documentos.** Resolveria o bug numa linha, mas tira a prévia no
  desktop, que é o fluxo que a #90 preservou de propósito, e no celular o requerimento iria para
  a pasta de downloads sem ser visto. Fica para o comprovante, onde é o comportamento certo.
- **Token gravado em tabela (como os de reset de senha).** Permitiria revogar, mas ninguém
  precisa revogar um link de uma hora, e custa uma escrita por clique em "PDF" mais limpeza.
- **Manter o POST e trocar `no-store` por `private, max-age`.** Não ajuda: o cache do Chrome
  não serve uma resposta de POST a um GET.
- **Cookie de curta duração emitido pelo POST, lido pelo GET.** Funciona no Chrome, mas o
  download do visualizador nem sempre manda cookies da aba (e em Safari, nunca por padrão para
  downloads iniciados fora do documento). O token na URL é o único sinal que sobrevive a todo
  caminho por onde o navegador pode refazer a requisição.

## Rotas auditadas

Todas as rotas que entregam arquivo, classificadas pelo mecanismo: o visualizador do Chrome refaz
um GET na URL da aba, então só quebra quem chega por POST e responde `inline`.

| Rota | Método | Disposição | Situação |
|---|---|---|---|
| `/solicitar/requerimento` | POST | inline | **quebrada**, esta change (link assinado + comprovante `attachment`) |
| `/admin/pedidos/[protocolo]/imprimir` (comprovante) | POST | inline | **quebrada para baixar**, esta change (`attachment`) |
| `/admin/pedidos/[protocolo]/imprimir` (requerimento, declaração, em branco) | GET | inline | ok |
| `/admin/documento` | GET | inline / attachment | ok |
| `/admin/transparencia/documento` | GET | inline | ok |
| `/admin/adequacao/anexo` | GET | inline / attachment | ok |
| `/admin/adequacao/exportar` | GET | attachment (JSON) | ok |
| `/solicitar/declaracao-hipossuficiencia` | GET | inline | ok |
| `/editais/[id]/arquivo` | GET | inline | ok |
| `/transparencia/boletim/[id]` | GET | inline | ok |
| `/transparencia/documento/[id]` | GET | inline | ok |
| `/protocolo/documento` | POST | attachment | ok: sem visualizador, sem refetch |
| `/lgpd/recibo` | POST | attachment | ok, idem |
| `/agendar/agenda` (`.ics`) | POST | attachment | ok, idem |

Ressalvas: nos três POST `attachment`, um download interrompido por queda de rede não "Retoma"
(o Chrome refaz por GET); só afeta downloads interrompidos. A classificação é estrutural; só a
rota pública foi reproduzida no servidor. Nenhum e2e da suíte usa `waitForEvent("download")`, e
é por isso que os dois POST `inline` passaram por duas changes sem serem notados.

## Verificação

- Unitário (`node --test`, `src/core/request/pdf-link.test.ts`): ida e volta; assinatura
  adulterada; payload adulterado; expirado; outra serventia; outro documento; string malformada
  não lança.
- e2e (`e2e/service-request.spec.ts`), fazendo o que o Chrome faz: após `request.post` com
  `documento: "declaracao"`, a resposta final (Playwright segue o 303) é `application/pdf` e
  `response.url()` casa com `/solicitar/requerimento/declaracao-<protocolo>.pdf?t=`; um
  `request.get(response.url())` devolve 200 e `application/pdf` (o refetch do visualizador);
  o mesmo GET com `t` trocado devolve 404; GET sem `t` devolve 404. Comprovante: `request.post`
  devolve `attachment; filename="comprovante-<protocolo>.pdf"`.
- Os testes de clique da #90 continuam valendo sem mudança: a aba abre e a tela da chave fica.
  O Chromium automatizado trata PDF como download e a aba fica em `about:blank`, então a URL
  final é conferida por `request`, como já se faz no arquivo.
- e2e do painel (`e2e/admin-service-requests.spec.ts`): o POST em `imprimir` com a chave
  responde `attachment; filename="comprovante-<protocolo>.pdf"`.
- Manual, pelo host do cartório no Homolog, num Chrome de verdade: abrir a declaração, clicar
  no ⬇ do visualizador, ver o arquivo salvo com o nome certo; clicar em "Baixar comprovante
  (PDF)" e ver o download direto com a tela da chave atrás.

## Riscos

- [Relógio] → `e` é em segundos de epoch, comparado no servidor; não depende do relógio do
  cidadão.
- [Link compartilhado] → Quem receber o link dentro da hora abre o PDF. É o mesmo que hoje
  acontece com o próprio PDF baixado; a diferença é a janela de uma hora. O cartório deve saber
  disso, e é o motivo de a validade ser curta.
- [Redirect e `Content-Disposition` nos testes existentes] → O e2e que hoje lê
  `content-disposition` da resposta do POST passa a ler da resposta final do redirect; o
  Playwright segue o 303 por padrão e o header é o mesmo.
- [Rate limit] → A rota GET faz HMAC antes de tocar o banco; um token inválido custa uma
  comparação. Um token válido custa o mesmo que o POST custa hoje.
