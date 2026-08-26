## Why

O balcão lança o pedido, a tela mostra protocolo e chave, e não há como imprimir nada: o
operador copia à mão ou o cidadão vai embora sem papel. Foi assim que o relato chegou ("não está
imprimindo o protocolo") depois de um lançamento manual real.

A rota que produz os dois PDFs já existe e funciona
(`/admin/pedidos/[protocolo]/imprimir`, GET para o requerimento e POST para o comprovante), com
autorização por sessão e a regra de que o comprovante só sai com a chave em claro que a tela
acabou de mostrar. O que nunca foi construído é o botão: nenhuma tela do painel aponta para essa
rota. O próprio teste e2e registra a lacuna ao bater na rota por API, com o comentário "the route
is the gate, not the button that links to it".

Isso não é funcionalidade nova: o requisito "Imprimir o requerimento no balcão" já está na spec
de `admin-service-requests` e diz que o detalhe do pedido SHALL oferecer a impressão, e que o
comprovante SHALL ser oferecido enquanto a chave recém-emitida estiver visível. A implementação
parou no backend.

## What Changes

- O detalhe do pedido passa a oferecer a impressão do requerimento, ligando o botão que faltava à
  rota GET que já existe. Cumpre requisito já especificado, não cria capacidade nova.
- A seção de chave de acesso (`key-section.tsx`), enquanto exibe uma chave recém-emitida, passa a
  oferecer a impressão do comprovante, postando essa chave para a rota POST. Idem: requisito já
  especificado.
- A tela de sucesso do lançamento manual (`/admin/pedidos/novo`) passa a oferecer as duas
  impressões, mais a ação de imprimir as duas de uma vez e a de copiar protocolo e chave juntos.
  Este é o caminho que o relato expôs e o único ponto em que a spec ainda não exigia impressão.
- A tela de sucesso passa a identificar o pedido que acabou de nascer (requerente e ato), hoje
  ausente: o operador vê só dois códigos soltos e nada que confirme que lançou o pedido certo.
- Toda emissão dos dois documentos passa a ser registrada em `audit_log`, com quem emitiu e
  quando, seguindo as convenções de verbo já usadas (`service-request.*`). Vale para as duas
  rotas, não só quando a impressão parte da tela nova: uma reimpressão do comprovante põe a chave
  de acesso do cidadão em claro na mão de quem imprimiu, e hoje isso não deixa rastro nenhum.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-service-requests` — três requisitos mudam:
  - "Imprimir o requerimento no balcão" ganha a exigência de registro em auditoria, hoje ausente
    do texto e do código.
  - "Lançar pedido manualmente para atendimento presencial" passa a exigir que a tela de sucesso
    identifique o pedido e ofereça a impressão dos dois documentos.
  - "Emitir nova chave de acesso" passa a nomear a impressão do comprovante como parte do momento
    em que a chave está visível, ligando-a ao requisito de impressão em vez de deixá-la implícita.

## Impact

- `src/app/admin/(dashboard)/pedidos/[protocolo]/imprimir/route.ts` — registro em auditoria nos
  dois métodos.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/_components/key-section.tsx` — ação de imprimir
  o comprovante enquanto a chave está na tela.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx` (ou o componente de cabeçalho do
  detalhe) — ação de imprimir o requerimento.
- `src/app/admin/(dashboard)/pedidos/novo/manual-entry-form.tsx` — tela de sucesso com
  identificação do pedido e as ações de impressão e cópia.
- `src/app/admin/(dashboard)/pedidos/novo/actions.ts` — o estado de sucesso passa a devolver o
  nome do requerente e o ato, hoje não retornados.
- `e2e/service-request.spec.ts` — o teste que hoje bate na rota por API pode passar a exercitar o
  botão; o comentário que registra a ausência deixa de valer.
- Sem migração de banco: `audit_log` já tem a forma necessária (`actorId`, `action`,
  `targetType`, `targetId`).
- Sem dependência nova. Sem alteração no site público.

## Non-Goals

- **Redesenhar os PDFs.** `buildRequerimento` e `buildAccessReceipt` ficam exatamente como estão.
  A arte de referência mostra campos que os documentos atuais não têm (endereço do requerente,
  checklist de documentos apresentados, valor e situação de pagamento, canhoto de protocolo de
  entrega para recorte); nada disso entra aqui. O que sai da impressora continua sendo o
  documento que o código já produz hoje.
- **Pré-visualizar os PDFs na tela.** Embutir os documentos exigiria renderizá-los no navegador,
  é a parte mais cara da arte de referência, e o ganho é pequeno: o operador imprime de todo
  jeito. A rota já devolve `inline`, então a aba de impressão é a própria pré-visualização.
- **Enviar o comprovante por WhatsApp.** É outro canal, com outra decisão a tomar (a chave de
  acesso viajaria por uma rede que a serventia não controla). Fora deste escopo por inteiro.
- **Baixar em vez de imprimir.** A rota responde `inline` por decisão registrada no código ("the
  operator prints from the tab, they are not filing a copy"); uma variante `attachment` não entra
  aqui.
- **Abrir a via assinada em vez de gerar o requerimento.** O cenário "Via assinada quando ela
  existe" já está na spec e também não está implementado: a rota GET sempre gera um documento
  novo, mesmo havendo requerimento assinado anexado. É uma lacuna real, contra requisito já
  escrito, mas independente desta: fica registrada aqui e é trabalho à parte.
- **Expor o histórico de impressões na interface.** As entradas de auditoria passam a existir e
  ficam consultáveis pelos caminhos que já leem `audit_log`; nenhuma tela nova para lê-las.
