# Aviso de resposta na LGPD e na Ouvidoria

## Why

Quando o encarregado responde um requerimento LGPD ou o ouvidor responde uma manifestação, o
cidadão não é avisado de nada. A resposta fica esperando ele lembrar de voltar ao site e
consultar o protocolo. Nos pedidos de serviço isso já foi resolvido: cinco momentos avisam por
e-mail. Os dois canais mais sensíveis da plataforma são justamente os que ficaram mudos.

Na LGPD o silêncio é pior, porque o prazo é legal: a Lei 13.709/2018 dá 15 dias para o
controlador responder. A serventia pode responder no prazo e ainda assim o titular descobrir
semanas depois, o que na prática esvazia o cumprimento e é o tipo de coisa que vira reclamação
na ANPD.

## What Changes

- Responder um requerimento LGPD passa a enviar um aviso ao e-mail do titular. O e-mail já é
  obrigatório no formulário do canal, então há sempre para onde escrever.
- Responder uma manifestação de ouvidoria passa a enviar o mesmo tipo de aviso, **quando houver
  contato de e-mail**. Manifestação anônima e manifestação identificada só com telefone
  continuam sem envio, sem erro e sem registro de falha: é o estado normal do canal.
- Os dois avisos seguem a regra que os pedidos de serviço já seguem: dizem que **existe**
  resposta e mandam consultar o protocolo com a chave. O texto da resposta MUST NOT viajar no
  e-mail.
- Nenhuma mudança no que a serventia faz: o aviso sai da mesma ação de responder que ela já usa,
  sem botão novo e sem passo a mais.

## Capabilities

### New Capabilities

Nenhuma. O comportamento entra nos dois canais que já existem.

### Modified Capabilities

- `data-rights-channel`: responder passa a avisar o titular por e-mail, sem carregar o conteúdo
  da resposta.
- `ombudsman-channel`: responder passa a avisar o manifestante por e-mail quando ele deixou um,
  preservando o anonimato quando não deixou.

## Impact

- `src/app/admin/(dashboard)/lgpd/[protocolo]/actions.ts` — carrega o registro (`findById`, como
  `/admin/pedidos` já faz) e chama `notifyCitizen` depois de responder.
- `src/app/admin/(dashboard)/ouvidoria/[protocolo]/actions.ts` — o mesmo, com o contato podendo
  ser ausente.
- `src/lib/email/service-request.ts` — nenhuma mudança: `notifyCitizen` já ignora contato que não
  é e-mail e já engole a própria falha.
- Sem migração, sem tabela nova, sem campo novo.

## Não-objetivos

- **Transcrição do chat.** O widget tem a caixa "receber transcrição", grava a escolha em
  `chat_conversations.wants_transcript_email` e nada lê essa coluna para enviar. É uma promessa
  quebrada e continua quebrada depois desta change: decisão explícita de tratar em separado,
  porque envolve decidir se um e-mail pode carregar a conversa inteira.
- Avisar o cidadão na **entrada** dos dois canais (o "recebemos seu requerimento"), como os
  pedidos de serviço fazem. A tela de envio já mostra protocolo e chave; o buraco que dói é o da
  resposta.
- Lembrete de prazo para a serventia, digest, ou qualquer envio que não seja reação direta a uma
  ação do operador.
- Mudar o que o e-mail carrega nos avisos que já existem.
