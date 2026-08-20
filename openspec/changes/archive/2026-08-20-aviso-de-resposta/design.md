# Design — aviso de resposta

## Context

`notifyCitizen` (`src/lib/email/service-request.ts`) já existe e já é usado em cinco momentos do
pedido de serviço. Ele carrega duas regras que servem exatamente para este caso: nunca põe o
conteúdo no e-mail (só o aviso de que algo aconteceu e o atalho para a consulta), e é melhor
esforço — chamado com `void`, engole a própria falha em log, e desiste em silêncio quando o
contato não é um e-mail.

Os dois canais respondem cada um por uma Server Action própria (`respondDataRights`,
`respondManifestation`), que hoje recebem só `requestId` e chamam `respondToRecord`. Nenhuma
delas carrega o registro, então nenhuma tem em mãos o contato nem o número do protocolo.

## Goals / Non-Goals

**Goals:**

- O titular LGPD e o manifestante identificado descobrem que foram respondidos sem depender de
  lembrar de voltar ao site.
- O anonimato da ouvidoria continua intacto: sem contato, nada é enviado e nada é registrado
  como falha.
- Zero mudança no trabalho do operador e zero mudança de schema.

**Non-Goals:**

- Transcrição do chat, aviso de entrada nos dois canais, lembrete de prazo (ver não-objetivos
  da proposta).

## Decisions

### Reusar `notifyCitizen`, não escrever um remetente novo

O e-mail que estes dois canais precisam é exatamente o que o pedido de serviço já manda: uma
linha dizendo o que aconteceu, o protocolo em destaque e o botão para a consulta. Um remetente
próprio por canal seria uma terceira cópia do mesmo cartão para manter em sincronia.

Alternativa rejeitada: um módulo `src/lib/email/channels.ts` com texto por canal. Só faria
sentido se o corpo divergisse, e ele não diverge — o que muda é uma frase, que é parâmetro.

### Carregar o registro com `findById`, como `/admin/pedidos` faz

As duas actions passam a ler o registro antes de responder, pelo mesmo helper que a action de
pedidos já usa. Isso dá `contact` e `protocolNumber` numa consulta, e de quebra permite recusar
cedo um `requestId` que não existe — hoje as duas seguem em frente e escrevem num id
inexistente sem reclamar.

Alternativa rejeitada: fazer `respondToRecord` devolver a linha atualizada (`.returning()`),
economizando uma consulta. É mais eficiente e foi tentador, mas muda a assinatura de uma função
compartilhada por quatro chamadores para servir dois. Uma consulta a mais numa ação que o
operador dispara uma vez por requerimento não é um custo que se pague com acoplamento.

### O aviso diz que existe resposta; o conteúdo fica atrás da chave

Vale para os dois canais e é a razão de a spec da LGPD dizer hoje que a resposta aparece "nunca
por outro canal". Essa frase continua verdadeira e passa a ser dita com mais precisão: o
**conteúdo** só na consulta, o **aviso de que há conteúdo** por e-mail. A distinção importa
porque o requerimento LGPD pode conter dado pessoal do próprio titular, e o e-mail é o canal que
a serventia não controla — vai parar em caixa compartilhada, em backup de provedor, em
encaminhamento.

### O que a verificação alcança, e o que não alcança

Descoberto na implementação: **o e2e não tem como observar e-mail neste projeto**. Sem
`RESEND_API_KEY` o envio vira uma linha no stdout do servidor, e o processo do Playwright não
tem acesso a esse stdout para fazer asserção; não existe mail-catcher no repositório. Montar um
seria infraestrutura nova de CI, e faria sentido cobrindo os onze e-mails da plataforma, não
estes dois — fica para uma change própria.

A regra que importa (quem recebe) é uma função pura, `isEmailContact`, e é lá que ela é travada
por teste. O e2e cobre o que a tela mostra: que a resposta chega à consulta do cidadão, com
contato de e-mail e com contato de telefone.

Descoberto também: **manifestação anônima não chega a esta ação**. O painel troca o formulário
de resposta por nota interna quando não há contato (`hasContact` em
`ouvidoria/[protocolo]/page.tsx`), então o cenário "anônima não recebe nada" descreve uma
defesa que a interface já impede antes. O caso alcançável de verdade é o identificado **só por
telefone**: o formulário aparece, a resposta é gravada, e nenhum e-mail sai.

### Ouvidoria: ausência de contato é caminho normal, não erro

`notifyCitizen` já devolve cedo quando o contato é nulo ou não é e-mail. A action não checa
nada, não ramifica e não loga: manifestação anônima é o estado que o canal promete na primeira
dobra da página, e tratá-la como falha de envio encheria o log de ruído sobre gente exercendo um
direito.

## Risks / Trade-offs

- [O titular recebe o aviso e a consulta ainda não mostra a resposta] → Não acontece: o e-mail
  sai depois de `respondToRecord`, que grava resposta e andamento na mesma escrita. Um envio que
  falhe não desfaz nada, e a consulta segue como sempre foi.
- [Aviso vira vetor de confirmação de que um protocolo existe] → O e-mail vai para o endereço
  que o próprio titular registrou, não para um informado agora; não há entrada de terceiro no
  fluxo.
- [Provedor de e-mail fora do ar na hora da resposta] → A resposta fica gravada e visível na
  consulta; o aviso é cortesia. Mesma postura dos cinco avisos que já existem.
- [Um requerimento sem contato válido] → Impossível na LGPD (campo obrigatório e validado como
  e-mail) e esperado na ouvidoria (ver decisão acima).

## Migration Plan

Nenhuma. Sem schema, sem dado a mover, sem dois deploys. Reverter é reverter o código.

## Open Questions

Nenhuma.
