## Why

Quando o funcionário anexa o documento final em "Entrega ao cidadão", nada mais acontece: o pedido fica em execução e o fluxo não fecha. Para concluir, ele precisa lembrar de abrir o andamento, escolher "Concluir com entrega digital" ou "Disponível para retirada" e, depois, "Registrar a entrega e concluir". Quando a retirada é no balcão, ninguém registra quem veio buscar o documento: não fica nome, documento nem relação com o solicitante, e a serventia perde a prova da entrega.

## What Changes

- **A pergunta.** Com o documento final anexado e liberado ao cidadão, o cartão de entrega do pedido pergunta como o pedido termina: "Concluir com entrega digital" (conclui na hora) ou "Aguardando retirada no balcão" (o pedido passa a "Disponível para retirada"). Quando o solicitante escolheu a forma ao pedir (digital ou papel), a pergunta já destaca essa. O cidadão é avisado por e-mail, como quando o andamento é mudado à mão.
- **Quem retirou.** Com o pedido aguardando retirada, o cartão mostra um formulário: quem retirou (o próprio solicitante, advogado ou procurador, pessoa autorizada, familiar ou outra pessoa), nome completo, documento apresentado (CPF, RG, CNH ou outro) com o número e uma observação opcional. O CPF é conferido pelos dígitos verificadores. Salvar registra a retirada com o dia e a hora de agora, o nome de quem registrou, e conclui o pedido.
- **A prova.** O número do documento fica guardado, mostrado ao painel com o meio escondido (o CPF como `529.***.***-25`), e nunca aparece ao cidadão. O ato entra na auditoria.
- **Documento retido.** Se o documento anexado ainda espera a assinatura, o cartão avisa que é preciso assinar antes de concluir, e a conclusão é recusada.
- **Nada se apaga.** A migração só cria uma tabela. Uma correção é uma nova linha, e a mais recente vale.

## Non-goals

- Mudar os andamentos nem a tela de mudar o andamento à mão, que continua valendo.
- Ler o documento de quem retirou, tirar foto dele ou colher assinatura.
- Mostrar a retirada ao cidadão na consulta.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: o fechamento da entrega e o registro de quem retirou.

## Impact

- Banco (só acrescenta): tabela `service_request_pickups`, mantida na limpeza do cartório de demonstração (a tabela não tem chave estrangeira e a limpeza é feita à mão pela Átrios).
- Auditoria: ação nova `service-request.pickup`.
- Painel: novo cartão no detalhe do pedido, logo abaixo de "Entrega ao cidadão".
