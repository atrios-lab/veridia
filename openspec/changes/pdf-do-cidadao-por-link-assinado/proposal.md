## Why

O cidadão abre o requerimento ou a declaração de hipossuficiência em aba nova, vê o PDF, e ao
clicar no botão de download do visualizador do Chrome recebe "O site não está disponível".
"Retomar" falha do mesmo jeito. O visualizador do Chrome (e do Edge) não salva a partir dos
bytes que já tem: dispara um download novo da URL da aba, por GET. A aba chegou ali por POST em
`/solicitar/requerimento`, que só tem POST, e o GET responde 405. Reproduzido no servidor local:
`GET /solicitar/requerimento` → 405. Imprimir funciona porque usa o que já está na aba; só
baixar e "salvar como" refazem a requisição. Firefox e Safari salvam do que carregaram, então o
bug aparece só em quem usa Chrome, que é a maioria.

A change `pdf-do-cidadao-abre-em-aba-nova` (#90) consertou o *ver*; o *baixar* nunca foi
exercitado, nem manualmente nem pelo e2e, que confere a aba e o conteúdo da rota, não o botão do
visualizador.

## What Changes

- O POST em `/solicitar/requerimento` continua recebendo protocolo e chave no corpo, mas, para o
  requerimento e a declaração, deixa de responder o PDF: verifica a chave e redireciona (303)
  para um link GET assinado, `/solicitar/requerimento/<documento>-<protocolo>.pdf?t=<token>`.
  O token é derivado no servidor, vale para um único documento de um único pedido de uma única
  serventia, e expira em uma hora. A chave de acesso continua sem trafegar em URL.
- Rota GET nova serve o PDF a partir do token, `inline` como hoje. O visualizador do Chrome
  refaz o GET e recebe o mesmo PDF; "Retomar" também.
- O comprovante de acesso, que carrega a própria chave e por isso não pode virar link, passa a
  responder ao POST como `attachment`: o navegador salva o arquivo direto, sem aba e sem
  refetch. É o único documento que o cidadão precisa guardar de qualquer jeito.
- No painel, o comprovante reemitido (POST em `imprimir`, na seção da chave do detalhe e no
  lançamento manual) tem o mesmo defeito e recebe o mesmo tratamento: `attachment`. O botão
  passa a dizer "Baixar comprovante (PDF)", e imprimir é abrir o arquivo salvo. É o único POST
  do painel; os demais documentos de lá já são GET e não sofrem disso.
- O nome da aba e o nome sugerido ao salvar passam a ser o do documento
  (`declaracao-REQ.2026.000295.pdf`), e não "requerimento": o PDF ganha o metadado `Title`, e
  o link termina no nome do arquivo.
- O e2e passa a fazer o que o Chrome faz: pega a URL em que a aba caiu e a busca de novo por GET,
  esperando o mesmo PDF; e confere que token adulterado, expirado ou de outra serventia dá 404.

## Non-goals

- Não toca nas rotas GET do painel (`imprimir`, `documento`, `transparencia/documento`,
  `adequacao/anexo`) nem nas rotas GET públicas (editais, boletim, documentos da transparência,
  formulário em branco): o refetch do visualizador repete a mesma requisição e funciona. O
  inventário completo está no design.
- Não toca nos três POST que já respondem `attachment` (`/protocolo/documento`, `/lgpd/recibo`,
  `/agendar/agenda`): sem visualizador não há refetch.
- Não muda `Cache-Control: private, no-store`. Mesmo sem ele o refetch chegaria ao servidor, e
  o `no-store` continua certo para um arquivo com dado pessoal.
- Não cria tabela nem grava token: ele é assinado e verificado sem banco (ver design).
- Não unifica o `ProtocolFields` triplicado (`request-form.tsx`, `protocol-lookup.tsx`,
  `protocol-trilho.tsx`); os forms não mudam de forma, só a rota muda de resposta.
- Não mexe no formulário em branco (`/solicitar/declaracao-hipossuficiencia`): já é GET sem
  chave e baixa normalmente.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: o requisito "Requerimento em PDF e envio do assinado" passa a exigir que o
  download funcione pelo visualizador do navegador (que refaz a requisição), define o link
  assinado de curta duração como o único lugar em que um documento do pedido é servido por GET,
  mantém a chave fora de URL e passa o comprovante a download direto.
- `admin-service-requests`: o requisito "Imprimir o requerimento no balcão" passa a entregar o
  comprovante reemitido como download direto, não como página para imprimir.

## Impact

- `src/core/request/pdf-link.ts` (novo, puro): assinar e verificar o token do link.
- `src/app/(public)/solicitar/requerimento/route.ts`: POST redireciona (requerimento,
  declaração) ou responde `attachment` (comprovante).
- `src/app/(public)/solicitar/requerimento/[arquivo]/route.ts` (novo): GET pelo token.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/imprimir/route.ts`: o POST do comprovante
  responde `attachment`.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/_components/key-section.tsx` e
  `src/app/admin/(dashboard)/pedidos/novo/manual-entry-form.tsx`: rótulo e estado do comprovante.
- `src/lib/pdf.ts`: metadado `Title` no PDF.
- `e2e/service-request.spec.ts` e `e2e/admin-service-requests.spec.ts`: refetch por GET, token
  inválido, comprovante como download nos dois lados.
- Sem migração de banco. Sem variável de ambiente nova: a chave de assinatura é derivada de
  `BETTER_AUTH_SECRET`, que todo ambiente já tem.
