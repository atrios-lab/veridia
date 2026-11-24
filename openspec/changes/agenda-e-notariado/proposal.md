## Why

O cartório emite o Certificado Digital Notarizado e faz os atos eletrônicos pelo e-Notariado,
e a cliente pediu uma agenda própria para esses atendimentos, para manter a ordem dos
agendamentos. Hoje existem duas agendas, a do balcão e a do tabelião, e esses atendimentos
caem numa delas, misturados com o resto.

A regra vigente está no Código Nacional de Normas do Foro Extrajudicial (Provimento CNJ n.
149/2023), Seção "Dos atos notariais eletrônicos por meio do e-Notariado" (arts. 284 a 317),
que incorporou o Provimento CNJ n. 100/2020, revogado. Conferido no texto oficial do CNJ em
24/11/2026.

## What Changes

- **Terceira agenda, "e-Notariado e certificado digital"** (`enotariado`), com grade, serviços,
  vagas por horário e canais próprios, como as outras. Sem horários, não aparece no site.
- **Serviços do e-Notariado** no catálogo, num grupo novo, sugeridos para a agenda nova:
  emissão do Certificado Digital Notarizado (gratuito, art. 292, § 4º); renovação ou nova
  emissão (art. 292, § 6º); assinatura de ato eletrônico por videoconferência (arts. 286, 287,
  302 e 303); reconhecimento de assinatura eletrônica, e-Not Assina (art. 306, III);
  reconhecimento de firma por autenticidade por videoconferência (arts. 306, IV, e 308);
  Autorização Eletrônica de Viagem (art. 444); autenticação digital pela CENAD (art. 305);
  ajuda para se cadastrar no e-Notariado; e **"Outro serviço do e-Notariado (não listado
  acima)"** (art. 309), com o detalhe escrito pelo cidadão.
- **Canal "Videoconferência no e-Notariado"**: a videoconferência notarial acontece dentro da
  plataforma (art. 287), então o cartório não manda link próprio. A agenda nova oferece só
  "Presencial" e esse canal; ligação telefônica não é videoconferência notarial (art. 286, I).
  O aviso de e-mail, lembrete, comprovante e protocolo explica como entrar.
- **"Como fazer" no painel**: o detalhe do agendamento de um serviço do e-Notariado mostra o
  passo a passo para quem atende, cada passo com o artigo, e o lembrete da tabela de
  emolumentos vigente quando o ato é cobrado por ela. O certificado é gratuito e não mostra a
  tabela.
- A escolha de canais de um dia específico passa a valer também para a agenda nova.
- **Ligar e desligar cada agenda.** Uma agenda com horários fica ligada; o botão "Desligar
  (pausar)" tira a agenda do site sem perder horários, serviços nem agendamentos, e "Ligar a
  agenda" a traz de volta. No painel, a agenda do e-Notariado só aparece para quem a usa
  (com horários ou agendamentos); quem não usa não vê.

## Impact

- `src/core/scheduling/agenda.ts` e `services.ts` (agenda, canais, catálogo e avisos).
- Painel: configuração da agenda (três abas), agenda do dia, canais do dia, detalhe do
  agendamento.
- Banco: nada muda. A coluna `appointments.agenda` é texto e a configuração fica no JSON da
  agenda; configurações antigas ganham a agenda nova vazia.
