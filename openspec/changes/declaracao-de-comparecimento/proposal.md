## Why

Quem vai ao cartório no horário de trabalho ou de aula precisa provar que esteve lá. O
cartório emitia isso à mão, sem padrão e sem como conferir.

## What Changes

- **Declaração de comparecimento** em PDF, com "República Federativa do Brasil", o timbre
  da serventia, o nome, o CPF (quando houver), o dia, o horário e o protocolo, a cidade e a
  data de emissão, a linha "Tabelião / Substituto / Escrevente Autorizado" com "(assinatura e
  carimbo)" e o QR Code de validação no site da própria serventia, com o código impresso.
- **Fundamento:** fé pública do tabelião e dos prepostos (Lei 8.935/1994, arts. 3º e 20) e o
  dever de atender com eficiência (art. 30, II). **Gratuita**: não é ato notarial nem de
  registro previsto em tabela (Lei 10.169/2000). Diz que o aproveitamento para justificar
  ausência depende da lei, da convenção coletiva e de quem a recebe. Não é "certidão": não
  reproduz livro. Não diz o assunto do atendimento.
- **Quando sai:** só para atendimento presencial marcado como atendido. No painel: botão
  "Declaração de comparecimento" na agenda do dia; o "Comprovante" de um atendido sai com a
  declaração na segunda página; e a mensagem de "Atendido" oferece a declaração.
- **Validação pública** em `/comparecimento/<id>.<código>`: o código é um HMAC, então um
  endereço inventado responde "Declaração não encontrada". Mostra a serventia, o nome
  abreviado, o dia e o horário.

## Não-objetivos

- Banco: nada muda. O código é calculado, não guardado.
- Assinatura digital: a declaração é assinada e carimbada no papel.
