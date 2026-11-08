## Why

A serventia tinha uma agenda só, com serviços digitados à mão e um alternador "só com o
tabelião". Na prática o balcão e o tabelião atendem em dias e horários diferentes, e cada
serventia digitava a própria lista de serviços, sem dizer ao cidadão o que levar. O cidadão
chegava sem os documentos e sem saber que precisava vir antes do horário.

## What Changes

- **Duas agendas.** "Atendimento do cartório" (balcão) e "Atendimento com o tabelião", cada uma
  com a sua grade semanal e os seus serviços. Uma agenda sem horários não aparece no site. As
  datas fechadas continuam valendo para as duas.
- **Catálogo de serviços de cartório de ofício único.** Todos os serviços das atribuições
  (atendimento geral, registro civil, notas, imóveis, protesto, títulos e documentos, pessoas
  jurídicas), cada um com a lista do que levar. O cartório só marca, em cada agenda, o que ela
  atende. Serviços próprios da serventia continuam possíveis, com a própria lista do que levar.
- **Site.** O cidadão escolhe a agenda, o dia, o horário e o serviço (já vendo o que levar),
  preenche os dados e, ao final, recebe a lista do que trazer, o aviso de chegar 15 minutos
  antes e o comprovante de agendamento em PDF com o timbre do cartório.
- **Comprovante.** PDF com protocolo AGD, data, horário, hora de chegada, agenda, serviço, dados
  do cidadão e lista do que trazer. Baixado na confirmação, anexado ao e-mail e impresso pelo
  painel em cada agendamento.
- **Painel.** A agenda do dia ganha abas por agenda; a configuração ganha abas, a lista
  completa de serviços para marcar e os serviços próprios.
- **Banco.** Só acrescenta: coluna `appointments.agenda` (texto, padrão `geral`). Todo
  agendamento anterior é do balcão. Configurações antigas viram a agenda do cartório, sem
  mudar nada no site até a serventia configurar a do tabelião.

## Não-objetivos

- **Horários independentes entre as agendas.** O índice único atual permite um agendamento por
  dia e horário na serventia inteira. Enquanto ele existir, um horário ocupado numa agenda fica
  ocupado na outra (o painel mostra "Ocupado por um agendamento da agenda Tabelião"). Trocar o
  índice exige removê-lo do banco, e isso vai numa change própria, revisada por uma pessoa.
- Fechar uma data só numa das agendas.
- Duração diferente por serviço.
