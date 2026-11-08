## Why

O tabelião pode atender presencialmente, por vídeo ou por ligação, e escolhe isso conforme o
dia: um dia só presencial, outro híbrido. A agenda do tabelião só oferecia os modos gerais da
serventia, os mesmos do balcão.

## What Changes

- **Canais do tabelião:** "Presencial", "Por vídeo" e "Por ligação". Na configuração, a aba do
  tabelião mostra os canais em cada dia da semana com horários; o padrão é presencial.
- **Uma data só:** na agenda do dia (aba do tabelião), "Como o tabelião atende em <data>"
  muda os canais só daquela data, com "Voltar ao padrão da semana".
- **Site:** na agenda do tabelião, o cidadão escolhe entre os canais do dia, com a explicação
  de cada um; num dia de canal único, o site diz que o tabelião atende só assim.
- **Confirmação, e-mail e comprovante:** por vídeo ou ligação não há "chegue 15 minutos
  antes": o aviso diz para estar disponível no horário (o link chega por e-mail, ou o tabelião
  liga no telefone informado) e a lista vira "O que ter em mãos".
- O balcão continua com os modos da serventia.

## Não-objetivos

- Nenhuma mudança no banco: os canais ficam na configuração (JSON) e o canal escolhido vai na
  coluna `mode` que o agendamento já tem.
- Gerar o link da videochamada: a serventia envia pelo e-mail, como já fazia no modo On-line.
