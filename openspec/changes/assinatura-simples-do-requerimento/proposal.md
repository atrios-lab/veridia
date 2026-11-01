## Why

O requerimento feito pelo site chega ao cartório sem assinatura. A tela de sucesso oferece
baixar o PDF, assinar no Gov.br e devolver o arquivo, mas a spec manda que esse envio seja
opcional, a tela abre com "Pedido registrado" e o passo 3 diz "pode ser agora, depois… ou no
balcão". Quase ninguém volta. A serventia abre uma nota de exigência, à mão, em cada pedido
para pedir a assinatura, e o prazo do pedido para até ela chegar.

A serventia decidiu aceitar a assinatura eletrônica simples feita na própria plataforma. Com
isso a assinatura passa a acontecer dentro do pedido, antes do envio, no mesmo gesto que o
protocola, e o cartório deixa de pedir o que o sistema pode colher.

## What Changes

- **Assinar antes de enviar.** A etapa 3 do pedido pelo site termina num bloco "Revise e
  assine": o texto do requerimento, o mesmo que o PDF imprime, e um campo onde a pessoa digita
  o nome completo. O botão passa a "Assinar e enviar pedido". O servidor só protocola o pedido
  com o nome digitado conferindo com o nome do requerente.
- **O pedido guarda o que foi assinado.** No submit o pedido grava o momento da assinatura, o
  nome digitado, o IP de quem assinou, a versão do texto e uma cópia do conteúdo assinado, com
  o hash SHA-256 desse conteúdo. A cópia existe porque o painel corrige nome, contato, CPF,
  finalidade, descrição e data do pedido depois de protocolado. A via assinada não pode mudar
  junto.
- **O PDF do requerimento sai com o carimbo da assinatura.** No lugar do parágrafo "Assine
  este requerimento pelo Gov.br…", o requerimento de um pedido assinado no site traz um bloco
  com quem assinou, quando, por qual canal, protocolo, IP e hash. É o mesmo desenho do carimbo
  da declaração de hipossuficiência.
- **A tela de sucesso perde os passos de assinar e enviar** num pedido sem gratuidade. Ficam
  guardar a chave e baixar a via assinada. Em pedido com gratuidade, a declaração continua
  pedindo assinatura e envio como hoje.
- **O Gov.br vira opção secundária.** A consulta do protocolo ainda aceita, num controle
  discreto, uma via assinada pelo Gov.br de quem a preferir. Quando ela existe, prevalece sobre
  a eletrônica no painel.
- **A consulta e o acompanhamento não pedem mais o requerimento assinado** de um pedido
  assinado no site: a linha "Requerimento assinado" já nasce concluída.
- **O painel mostra a assinatura.** No detalhe aparece "Assinado eletronicamente em <data>".
  A ação principal do cabeçalho passa a "Requerimento assinado" e abre a via eletrônica.
  "Gerar sem assinatura" continua gerando a folha limpa com os dados atuais. Se a serventia
  corrigiu dados depois da assinatura, o detalhe avisa.
- **BREAKING (formulário público).** `submitServiceRequest` passa a exigir o nome digitado. Um
  envio sem ele é recusado com erro de validação no campo. Pedidos antigos, sem assinatura
  gravada, continuam como estão, com o envio do assinado pelo Gov.br e o aviso na consulta.

### Tratamento do IP (LGPD)

O IP da assinatura segue a finalidade, a base legal, a retenção e o acesso já registrados para
o IP do aceite da declaração (change `redesenhar-declaracao-com-carimbo`, "Tratamento do IP").
A finalidade se estende de "declaração recebida por meio eletrônico" para "requerimento
assinado por meio eletrônico num acesso individual, na data e hora registradas".

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `service-request`: requisito novo de assinatura eletrônica simples no pedido pelo site;
  "Requerimento em PDF e envio do assinado" troca os passos de assinar e enviar pela via com
  carimbo, e deixa o Gov.br como opção.
- `admin-service-requests`: "Imprimir o requerimento no balcão" passa a reconhecer a via
  eletrônica; requisito novo para a assinatura aparecer no detalhe e para a correção depois da
  assinatura ficar à vista.

Os deltas partem do texto da change `via-assinada-no-painel`, implementada e ainda não
arquivada. Ela precisa ser arquivada antes desta.

## Impact

- `src/core/request/`: núcleo puro da assinatura (normalização e conferência do nome,
  conteúdo assinado, hash canônico, texto versionado). `requerimento.ts` aceita o carimbo no
  lugar do parágrafo de assinatura.
- `src/core/request/form.ts`: o schema público ganha o nome digitado.
- `src/app/(public)/solicitar/actions.ts`: o submit monta e grava `details.signature`.
- `src/lib/service-request.ts`: o hash usa o protocolo, que nasce em `createRecordWith`. A
  assinatura é gravada na mesma transação.
- `src/app/(public)/solicitar/request-form.tsx`: bloco "Revise e assine" e tela de sucesso.
- `src/app/(public)/protocolo/` e `src/app/(public)/acompanhar/protocol-trilho.tsx`: a linha
  da assinatura e "Falta só a sua assinatura." leem a assinatura eletrônica.
- `src/lib/pdf-form.ts` / `src/lib/pdf.ts`: o carimbo no requerimento.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/`: cabeçalho, detalhe e aviso de correção.
- Sem migração: `details` é JSON e cresce de forma aditiva.

## Non-Goals

- **A declaração de hipossuficiência.** Ela continua com o aceite, o carimbo de recebimento e
  o envio assinado de hoje. O beneficiário pode não ser o requerente (representante legal), e
  na habilitação de casamento são dois nubentes: o requerente não assina por eles.
- **O balcão.** O pedido lançado pelo painel não ganha assinatura eletrônica: o aceite
  presencial é o papel assinado, como na declaração.
- **Assinatura avançada ou qualificada.** Não há integração com a API de assinatura do Gov.br
  nem com ICP-Brasil. O arquivo enviado pelo Gov.br continua sendo guardado sem validação.
- **Confirmar o e-mail ou o telefone** antes de assinar. A identificação é a que o pedido já
  colhe, mais o IP. Se a serventia quiser mais, é outra change.
- **Assinar os anexos.** O hash cobre o conteúdo do requerimento, não os arquivos que a pessoa
  anexou.
- **Assinar de novo depois de uma correção.** A correção é ato da serventia, registrado no
  histórico. A via assinada continua sendo a do momento da assinatura.
