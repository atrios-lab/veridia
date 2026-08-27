## Why

Quando o cidadão informa um e-mail que não existe, o sistema não fica sabendo. A mensagem sai, o
servidor do destinatário devolve, e o retorno morre no painel do Postmark, que a serventia não
abre. Do lado de cá tudo parece ter dado certo: o pedido está lá, a exigência foi "enviada", e o
cidadão nunca soube. O atendente só descobre quando a pessoa aparece no balcão perguntando por
que ninguém respondeu.

Foi assim que os três bounces de 25 e 26/08/2026 passaram despercebidos até alguém abrir o
Postmark por outro motivo. Dois deles eram e-mails de exigência e de ouvidoria para cidadãos.

Não dá para conferir no formulário se uma caixa existe. Medido nos três endereços que voltaram,
os três estão em domínios que existem e recebem e-mail (`email.com`, `atrioss.com`): o que estava
errado era a parte antes do `@`, e essa metade só o servidor que recebe conhece. Ele conta
devolvendo a mensagem, e devolver é a única resposta honesta que existe. O que falta não é uma
validação a mais no campo: é escutar a devolução.

## What Changes

- Novo endpoint que recebe os avisos de retorno do Postmark (webhook de bounce), autenticado por
  segredo compartilhado.
- Nova tabela de endereços que voltaram: o endereço, o tipo do retorno, a descrição do provedor e
  quando aconteceu. Indexada pelo endereço, não pelo registro, porque o mesmo e-mail aparece em
  pedido, agendamento, ouvidoria e conta do painel, e a resposta é a mesma para todos.
- O envio para um endereço que já voltou é recusado no servidor, antes de chamar o provedor, com
  a explicação na tela de quem tentou: qual endereço, e o que o provedor respondeu quando a
  mensagem voltou.

O aviso aparece no momento em que alguém tenta mandar, e em nenhum outro. É quando a informação
muda uma decisão, e é o único lugar onde ela não pode passar batida — um selo na tela do pedido
compete com tudo o mais que está na tela, e o atendente que não ia mandar e-mail nenhum não
precisava saber.

**Não-objetivos**:
- Marcadores passivos nas telas que exibem endereço (pedido, agenda, ouvidoria, contas). O
  registro fica no banco desde já, então acrescentá-los depois é ler uma tabela que já existe; o
  que esta change entrega é a recusa no momento do envio, que é onde a informação decide algo.
- Verificar no formulário se a caixa existe. Não é possível com honestidade: sondar por SMTP é
  comportamento de quem varre endereços para spam, rende bloqueio de IP, e mesmo assim a maioria
  dos servidores aceita tudo e só devolve depois. Serviço pago de verificação tem as mesmas
  limitações e uma dependência nova.
- Checar o registro MX do domínio como trava. Pega erro de digitação no domínio (`gmial.com` não
  tem MX), mas **teria pegado zero dos três** retornos reais, e um DNS instável impediria o cidadão
  de enviar o pedido dele. Se um dia entrar, entra como sugestão ("você quis dizer gmail.com?"),
  nunca como bloqueio, e em change própria.
- Reenviar sozinho para outro endereço, ou trocar o e-mail do cadastro automaticamente. Quem
  decide o que fazer com um contato que não responde é a serventia.
- Tratar retorno leve (caixa cheia, resposta automática de férias) como endereço inválido. São
  tipos distintos no Postmark e a tela diz qual foi.

## Capabilities

### New Capabilities

- `email-delivery`: o que o sistema faz quando uma mensagem enviada volta — receber o aviso do
  provedor, registrar o endereço e mostrar isso a quem atende.

## Impact

- `src/db/schema.ts`: nova tabela de retornos, migração aditiva.
- `src/app/api/postmark/bounce/route.ts`: endpoint novo.
- `src/lib/email/`: consulta "este endereço voltou?" para as telas.
- `src/lib/email/send.ts`: a recusa antes da chamada ao provedor.
- As server actions que enviam e-mail passam a tratar essa recusa como erro explicado, não como
  falha genérica de envio.
- `.env.example`: segredo do webhook.
- Configuração no Postmark (aba Webhooks) apontando para o endpoint: passo de operação, fora do
  código.
