## ADDED Requirements

### Requirement: Consulta de protocolo exibe o valor e a forma de pagamento do pedido

Quando um pedido de serviço tem `amountCents` definido, a consulta pública de protocolo SHALL
exibir esse valor formatado em reais, tanto no resumo sem chave de acesso quanto no detalhe
completo com chave. Quando também houver QR Pix disponível para o pedido (chave e cidade da
serventia cadastradas), a tela SHALL exibir o QR code e o código "Copia e Cola" junto do valor.
Faltando QR disponível, a tela SHALL exibir o valor acompanhado da instrução de pagar no balcão da
serventia.

Um pedido sem valor definido SHALL continuar sem exibir nada relacionado a pagamento, como hoje.

#### Scenario: Valor aparece assim que informado
- **WHEN** o operador informa o valor de um pedido e o cidadão consulta o protocolo, com ou sem a
  chave de acesso
- **THEN** o valor formatado aparece na tela

#### Scenario: QR aparece junto do valor quando disponível
- **WHEN** o pedido tem valor definido e a serventia tem chave Pix e cidade cadastradas
- **THEN** a consulta de protocolo mostra o valor, o QR code Pix e o código Copia e Cola com botão
  de copiar

#### Scenario: Sem QR disponível, aparece a instrução de pagar no balcão
- **WHEN** o pedido tem valor definido mas a serventia não tem chave Pix, ou não tem cidade,
  cadastrada
- **THEN** a consulta de protocolo mostra o valor e a instrução de pagar no balcão da serventia,
  sem QR code

#### Scenario: Pedido sem valor continua sem nada de pagamento
- **WHEN** um pedido não tem `amountCents` definido
- **THEN** a consulta de protocolo não exibe valor, QR nem instrução de pagamento, como antes desta
  mudança
