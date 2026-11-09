## ADDED Requirements

### Requirement: Prenotação segue direto para o pagamento e mostra a análise

Na prenotação, ao enviar o requerimento assinado pela tela de sucesso, o site SHALL abrir a
página do pedido já consultada, sem pedir a chave de novo e sem levá-la na URL. A página do
pedido SHALL chamar as etapas finais de "Análise do título" e "Resultado da análise", dizer que
o título entra em análise depois do pagamento e informar o prazo; quando houver prazo legal,
SHALL citar o fundamento.

#### Scenario: Requerimento anexado na tela de sucesso

- **WHEN** o cidadão anexa o requerimento assinado de uma prenotação de Imóveis
- **THEN** o site abre a página do pedido em "Falta só o pagamento", com o valor da prenotação e o Pix

#### Scenario: Pagamento confirmado

- **WHEN** a serventia confirma o pagamento
- **THEN** a página diz "Seu título está em análise" e "Resultado da análise: até <data>. Prazo legal: 10 dias úteis para o registro ou a nota devolutiva. Fundamento: Lei n. 6.015/1973, art. 188 (redação da Lei n. 14.382/2022)."
