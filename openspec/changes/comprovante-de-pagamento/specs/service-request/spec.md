## ADDED Requirements

### Requirement: Cidadão informa o pagamento anexando o comprovante

A consulta de protocolo SHALL oferecer a ação "Já paguei", nas duas telas (`/protocolo` e
`/acompanhar`), atrás da chave de acesso, quando o pedido tem valor informado e ainda não está
pago nem com pagamento informado. A ação, que exige o envio de exatamente um comprovante (imagem ou PDF,
mesmos limites de tipo e tamanho dos demais uploads). O envio SHALL gravar o comprovante como
anexo do pedido, de tipo próprio (comprovante de pagamento, distinto dos documentos do cidadão),
e SHALL mover o andamento para "Pagamento informado". A escrita SHALL exigir protocolo + chave
válidos com a mesma resposta neutra das demais rotas e SHALL passar pelo mesmo rate limit dos
demais envios do cidadão. A consulta NÃO SHALL afirmar que o pagamento é confirmado sozinho.

#### Scenario: Comprovante enviado move o andamento
- **WHEN** o cidadão, com a chave, aciona "Já paguei" e envia o comprovante em PDF
- **THEN** o pedido passa a "Pagamento informado", o comprovante fica gravado como anexo do
  pedido e a consulta mostra que o comprovante foi recebido e está em conferência, com o nome do
  arquivo

#### Scenario: Sem arquivo não há aviso
- **WHEN** o cidadão aciona "Já paguei" sem escolher arquivo
- **THEN** o envio é recusado com mensagem clara, nada é gravado e o andamento não muda

#### Scenario: Arquivo inválido recusado
- **WHEN** o comprovante não é imagem nem PDF, ou excede o tamanho permitido
- **THEN** o envio é recusado com mensagem clara, nada é gravado e o andamento não muda

#### Scenario: Chave errada
- **WHEN** o envio chega com chave que não confere
- **THEN** a resposta é a mesma de protocolo inexistente, e nada é gravado

#### Scenario: Pedido sem valor não oferece a ação
- **WHEN** o pedido não tem valor informado
- **THEN** a ação "Já paguei" não aparece e o servidor recusa o envio se ele chegar mesmo assim

### Requirement: Consulta reflete o pagamento informado no lugar do QR

Enquanto o pedido estiver em "Pagamento informado", a consulta de protocolo SHALL exibir o
valor e a indicação de que o comprovante foi recebido e aguarda conferência da serventia, e NÃO
SHALL exibir o QR code, o código Copia e Cola nem a instrução de pagar no balcão. O cidadão
SHALL poder enviar outro comprovante nesse estado (para corrigir um envio errado); o novo
arquivo entra como mais um anexo e o andamento permanece "Pagamento informado". Se a serventia
devolver o pedido para "Aguardando pagamento", o QR SHALL voltar a aparecer.

#### Scenario: QR some depois do aviso
- **WHEN** o cidadão reabre a consulta de um pedido em "Pagamento informado"
- **THEN** vê o valor e "comprovante recebido, em conferência", sem QR nem Copia e Cola

#### Scenario: Reenvio de comprovante
- **WHEN** o cidadão envia um segundo comprovante em "Pagamento informado"
- **THEN** o arquivo é gravado, a consulta mostra o mais recente e o andamento não muda

#### Scenario: Serventia devolve para aguardando
- **WHEN** a serventia move o pedido de "Pagamento informado" para "Aguardando pagamento"
- **THEN** a consulta volta a exibir o QR e a ação "Já paguei"

#### Scenario: Pagamento confirmado encerra o bloco
- **WHEN** a serventia move o pedido para "Pago"
- **THEN** a consulta mostra "Pagamento confirmado", sem QR e sem a ação "Já paguei"
