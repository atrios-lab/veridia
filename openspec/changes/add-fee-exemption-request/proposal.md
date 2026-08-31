## Why

Quem é beneficiário de programa social (CadÚnico, atendido nos CRAS) tem direito por lei à
gratuidade em atos do registro civil: a habilitação de casamento, o registro e a primeira
certidão são isentos para quem declara pobreza (CC art. 1.512, parágrafo único), e a certidão de
nascimento e a de óbito são gratuitas para os reconhecidamente pobres (CF art. 5º, LXXVI; Lei
6.015 art. 30 §1º, red. Lei 9.534/97). O site não oferece caminho nenhum para pedir isso: o
cidadão isento preenche o mesmo formulário de quem paga e a serventia descobre a gratuidade na
conversa, ou não descobre. É o SCRUM-11, pedido pelo cartório.

O card também diz como: o pedido precisa vir com a documentação anexada e com uma declaração de
veracidade que avise que as informações serão conferidas nos sistemas governamentais de benefício
social e que declaração falsa responde criminal e civilmente, com a lei e o artigo escritos.

## What Changes

- Os atos que a lei isenta ganham a opção **"Solicitar gratuidade (ISENTO)"** no formulário
  público: a certidão de RCPN e a habilitação de casamento.
- Marcar a opção exige **uma declaração própria**, além dos dois aceites que já existem: o
  requerente declara ser beneficiário de programa social, autoriza a conferência nos sistemas
  governamentais de benefício social e fica ciente de que declaração falsa responde criminalmente
  (CP art. 299) e civilmente (CC arts. 186 e 927). A lei e o artigo aparecem no próprio texto.
- Marcar a opção exige **pelo menos um anexo**: a documentação que comprova o benefício. O card é
  explícito ("precisa apresentar toda documentação"), então aqui o anexo deixa de ser opcional.
- O bloco **diz quais documentos servem**, em vez de pedir "a documentação" e deixar o cidadão
  adivinhar: Folha Resumo do CadÚnico, declaração do CRAS ou cartão de programa social, qualquer
  um deles. Um chute errado aqui volta como exigência uma semana depois.
- A declaração é **gravada com data** no registro do pedido, como os aceites já são: a prova é do
  controlador.
- O operador vê a gratuidade solicitada na tela do pedido, e o requerimento impresso, que o
  cidadão assina, carrega a declaração.

## Capabilities

### New Capabilities

Nenhuma. A mudança acrescenta requisito a uma capacidade que já existe.

### Modified Capabilities

- `service-request`: o pedido dos atos isentáveis passa a aceitar a solicitação de gratuidade,
  com declaração específica, anexo obrigatório e registro da declaração.

## Impact

- `src/core/acts/catalog.ts`: sinalizador de isenção nos dois atos, com a base legal de cada um,
  e o texto da declaração.
- `src/core/request/form.ts`: `publicServiceRequestSchema` ganha os dois campos e a regra que os
  amarra.
- `src/core/request/kinds.ts`: `details.exemption` com a data da declaração.
- `src/core/request/requerimento.ts`: a declaração no PDF que o cidadão assina.
- `src/app/(public)/solicitar/`: formulário e action (inclusive a contagem de anexos).
- `src/app/admin/(dashboard)/pedidos/[protocolo]/`: exibição para o operador.
- Testes de núcleo e e2e.

## Non-Goals

- **O valor não é zerado automaticamente.** Gratuidade solicitada não é gratuidade concedida:
  quem confere o benefício nos sistemas e decide é a serventia, e `amountCents` continua sendo
  informado pelo operador, como hoje.
- **O balcão não muda.** Atendimento presencial de isento já acontece com o operador na frente e
  os documentos em mãos.
- **Nenhuma integração com sistemas de benefício social.** O texto avisa que haverá conferência;
  a conferência em si é trabalho da serventia, fora do site.
- **O registro de nascimento em si não entra**, por dois motivos independentes. O primeiro é que
  ele já é gratuito para todos, e não só para beneficiário de programa social (Lei 9.534/97):
  não há isenção a solicitar, e pedir declaração de pobreza por algo que já é de graça para
  qualquer pessoa seria atrito sem propósito. O segundo é que ele não existe no catálogo de atos,
  então não há formulário onde pôr a opção. Se o ato deve ser oferecido pelo site, e em que modo,
  é pergunta legítima e separada desta: vale um card próprio.
- Outros atos e outras atribuições não ganham a opção neste change.
