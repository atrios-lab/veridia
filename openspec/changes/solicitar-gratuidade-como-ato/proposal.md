## Why

A gratuidade nasceu como um checkbox escondido dentro do formulário de dois atos: quem vai pedir
uma certidão isenta precisa primeiro saber que o caminho é "Certidão", entrar nela, preencher, e
só lá embaixo achar a opção. Quem chega ao site sabendo apenas que tem direito à isenção não tem
onde clicar. Joelison, pela serventia, pediu que a gratuidade apareça como um ato a mais na lista
do Registro Civil: um item próprio, visível na mesma tela em que o cidadão escolhe entre certidão,
habilitação e retificação, que abre o pedido de isenção dos atos do RCPN que a lei isenta.

## What Changes

- O RCPN ganha uma entrada própria na tela "Escolha o ato": **"Solicitar gratuidade (isento)"**,
  ao lado dos demais atos, com o mesmo selo de tramitação que os outros exibem.
- Escolhida a entrada, o cidadão **diz qual ato quer isento** antes de preencher o resto: a
  certidão de RCPN ou a habilitação de casamento, os dois que a lei isenta. A base legal mostrada
  é a do ato escolhido, não uma genérica.
- O pedido continua exigindo o que a change anterior fixou: a declaração específica de
  beneficiário de programa social, com CP art. 299 e CC arts. 186 e 927 no texto, e pelo menos um
  anexo comprovando o benefício, com a lista de exemplos aberta.
- **BREAKING (para o cidadão, não para os dados):** o checkbox "Solicitar gratuidade (ISENTO)"
  **sai** dos formulários da certidão e da habilitação. Passa a existir um caminho só. Pedidos já
  protocolados pelo caminho antigo continuam válidos e continuam sendo lidos como são: o formato
  gravado em `details.exemption` não muda.
- O operador continua vendo "Gratuidade solicitada (ISENTO)" na tela do pedido, e o requerimento
  impresso continua carregando a declaração. O que muda é por onde o cidadão entra, e que o pedido
  agora também registra **qual ato** a isenção pede.

## Capabilities

### New Capabilities

Nenhuma. A porta de entrada muda de lugar dentro de uma capacidade que já existe.

### Modified Capabilities

- `service-request`: a solicitação de gratuidade deixa de ser uma opção dentro do formulário dos
  atos isentáveis e passa a ser um item próprio da lista de atos do RCPN, que pergunta qual ato
  quer isento e grava essa escolha junto da declaração.

## Impact

- `src/core/acts/catalog.ts`: o ato da gratuidade (sintético, no padrão de `otherAct`, ou fixo em
  `ACTS`), a função que lista os atos isentáveis de uma atribuição, e a entrada na lista do RCPN.
- `src/core/request/form.ts`: campo do ato-alvo, obrigatório só no ato da gratuidade; a regra que
  hoje recusa gratuidade em ato não isentável passa a valer sobre o ato-alvo.
- `src/core/request/kinds.ts`: `details.exemption` ganha o ato pedido, ao lado de `declaredAt`.
- `src/core/request/requerimento.ts`: o requerimento nomeia o ato que a isenção pede.
- `src/app/(public)/solicitar/`: a lista de atos, o formulário (bloco novo, checkbox removido) e a
  action.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/`: o pedido de gratuidade mostra qual ato.
- Testes de núcleo e e2e, inclusive os que hoje afirmam que o checkbox existe.

## Non-Goals

- **Nenhuma mudança no que a gratuidade significa.** Solicitar não concede: `amountCents` continua
  sendo decisão do operador, sem cálculo automático, e nenhuma integração com sistema de benefício
  social entra aqui.
- **Nada muda no texto da declaração nem na lista de documentos.** São os mesmos aprovados na
  change anterior, e a palavra final sobre eles continua sendo da serventia.
- **Outras atribuições não ganham a entrada.** Só o RCPN tem ato com previsão legal de isenção no
  catálogo; se um dia outra tiver, a entrada se generaliza sozinha, mas isso não se antecipa aqui.
- **O registro de nascimento continua fora**, pelos mesmos dois motivos da change anterior: já é
  gratuito para todos, e não existe no catálogo.
- **A migração de pedidos antigos não acontece.** O que já foi protocolado com gratuidade fica
  como está, sem ato-alvo gravado; a tela do painel lida com a ausência em vez de inventar um.
