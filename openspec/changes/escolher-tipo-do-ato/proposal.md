## Why

Alguns atos do catálogo agrupam mais de um tipo no mesmo nome, como "Certidão (nascimento, casamento, óbito)", e o pedido não registra qual deles o cidadão quer: a serventia precisa procurar na descrição, que é opcional, ou entrar em contato. O mesmo agrupamento também barra um pedido legítimo: quem tem uma certidão de nascimento em aberto e pede uma de casamento recebe o aviso de pedido duplicado, porque a checagem só compara o ato e o cidadão.

## What Changes

- Os atos que agrupam tipos passam a declarar no catálogo as opções e a pergunta do select:
  - **Certidão RCPN:** nascimento, casamento, óbito ou outra
  - **Escritura ou procuração:** escritura pública ou procuração
  - **Certidão de RI:** matrícula, inteiro teor ou ônus
  - **Busca por indicador:** pessoal ou real
  - **Registro ou averbação na matrícula:** registro ou averbação
  - **Registro RTD:** documento ou contrato
- O formulário do pedido, no site e no balcão, mostra um select obrigatório acima da descrição quando o ato tem tipos. No site, o servidor recusa pedido sem tipo ou com tipo que não pertence ao ato; no balcão, a mesma regra vale pelo schema compartilhado.
- Escolher "Outra certidão" torna a descrição obrigatória.
- Na gratuidade, o select aparece dentro do bloco da gratuidade quando o ato escolhido tem tipos.
- O detalhe do pedido no painel mostra o nome específico, como "Certidão de casamento", no lugar do nome agrupado. A fila, a consulta do protocolo, a tela de sucesso e o requerimento em PDF seguem o mesmo nome.
- O operador pode corrigir o tipo no formulário de edição do detalhe: o tipo não muda a atribuição nem a base legal do que foi protocolado.
- A checagem de pedido duplicado passa a considerar o tipo: tipos diferentes do mesmo ato não são duplicados.
- Pedidos anteriores à mudança continuam mostrando o nome agrupado, sem inferir o tipo.

## Non-goals

- **Atos cujas opções não são excludentes:** "Registro de constituição (estatuto, ata, contrato)" e "Retificação de registro (área, descrição)" ficam sem select, porque o mesmo pedido pode envolver mais de um item.
- **Prazo por tipo:** o prazo continua sendo o do ato, inclusive na certidão de RI. O inteiro teor em 4 horas não cabe na contagem em dias, e isso já é assim hoje.
- **Valor ou documentos por tipo:** o tipo não muda emolumentos, a lista de documentos nem a orientação do ato.
- **Declaração de hipossuficiência:** o Anexo I é impresso com o texto oficial e não muda; o hash do aceite também não.
- **Duplicado do mesmo tipo:** dois pedidos do mesmo tipo pelo mesmo cidadão, como certidões de nascimento de dois filhos, continuam barrados.
- **Duplicado entre atos da gratuidade:** a checagem continua sem comparar o ato escolhido dentro da gratuidade.
- **Filtro ou busca por tipo na fila:** a fila só mostra o nome específico.
- **Nome do ato na etapa 2 e no cartão lateral:** o nome agrupado continua ali, porque é o que ajuda quem não conhece os termos do cartório.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: o catálogo e o formulário passam a ter o tipo do ato, com validação, documentos, consulta e checagem de duplicado.
- `admin-service-requests`: o lançamento no balcão pede o tipo; a fila e o detalhe mostram o nome específico; a correção dos dados passa a incluir o tipo.

## Impact

- **Núcleo:** `src/core/acts/catalog.ts`, `src/core/request/form.ts`, `src/core/request/kinds.ts`, `src/core/request/edit.ts`, `src/core/request/requerimento.ts`.
- **Persistência:** `src/lib/service-request.ts` e `src/lib/request-documents.ts`. O tipo fica em `details`, sem migração de banco.
- **Site:** `src/app/(public)/solicitar/` e `src/app/(public)/protocolo/actions.ts`.
- **Painel:** `src/app/admin/(dashboard)/pedidos/` (fila, detalhe, edição e lançamento no balcão).
- **Dependências:** nenhuma nova.
