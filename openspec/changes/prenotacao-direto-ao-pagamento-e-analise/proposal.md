## Why

Na prenotação, depois de anexar o requerimento assinado na tela de sucesso, o cidadão ficava
com "Acompanhar pedido" e "Novo pedido", e ao acompanhar tinha de digitar a chave de novo para
chegar ao pagamento. E a página do pedido falava em "Preparando o documento", quando na
prenotação o que vem é a análise do título.

## What Changes

- **Direto ao pagamento**: na prenotação, anexado o requerimento assinado, o site abre a página
  do pedido já consultada, na etapa do pagamento (Pix). "Acompanhar pedido" também abre sem
  pedir a chave. A chave vai pela memória da aba (`sessionStorage`), usada uma vez, nunca pela
  URL; sem ela, a página pede a chave como antes.
- **Análise no lugar de "preparar o documento"**: na prenotação, as etapas são "Análise do
  título" e "Resultado da análise"; os textos dizem que o título entra em análise depois do
  pagamento e que em breve sai o resultado (o registro, ou a nota com o que falta).
- **Prazo legal e fundamento**: na prenotação de Imóveis, 10 dias úteis para o registro ou a
  nota devolutiva (Lei n. 6.015/1973, art. 188, redação da Lei n. 14.382/2022). Em Títulos e
  Documentos e Pessoas Jurídicas, sem prazo legal no catálogo, vale o prazo da serventia, dito
  como tal.
- **Banco**: nada muda.
