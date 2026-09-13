## Context

A chave de acesso nasce em `generateAccessKey` (`src/core/request/access-key.ts`), é gravada só
como hash e devolvida em claro uma vez, na resposta da action que criou o pedido
(`createServiceRequestAction` em `solicitar/actions.ts`, `createManualRequestAction` em
`pedidos/novo/actions.ts`). A tela de sucesso do site mostra protocolo e chave em `ProtocolReveal`
(com "copiar") e oferece o comprovante em PDF pela rota `solicitar/requerimento` (POST com
`accessKey`). O e-mail "Pedido recebido" sai por `notifyCitizen` (`src/lib/email/service-
request.ts`), que por contrato nunca carrega conteúdo: só protocolo, corpo curto e o botão
"Consultar o protocolo"; o rodapé fixo de `renderNoticeEmailHtml` diz "este aviso não traz o
conteúdo por segurança".

A consulta (`/protocolo`, `protocol-lookup.tsx`) mostra `LostKeyNotice`: "Perdeu a chave? A
serventia emite outra pelo WhatsApp ou telefone". `protocolo/actions.ts` já usa `isRateLimited`
e tem `findByProtocol(tenantSlug, protocolNumber)` em `src/lib/service-request.ts`.

No painel, `KeySection` (`pedidos/[protocolo]/_components/key-section.tsx`) mostra
"••••  ••••  ••••" e o botão "Emitir nova chave" (`reissueKeyAction` → `reissueAccessKey`, que
troca o hash, audita `service-request.key-reissue` com o operador como ator e devolve a chave
nova). Com a chave na resposta, a seção a renderiza em claro e oferece "Baixar comprovante
(PDF)" pela rota `pedidos/[protocolo]/imprimir` (POST com `chave`). O balcão
(`manual-entry-form.tsx`) mostra a chave com "copiar" e imprime o comprovante pela mesma rota.

`notifyCitizen` já faz duas coisas que a recuperação precisa: consulta `findPermanentBounce`
antes de agendar o envio e entrega o envio a `after` para o `fetch` não morrer com a resposta.
A auditoria aceita `actorId: null` ("filed by the citizen, who has no account by design"), mas o
histórico do detalhe hoje cai em "Sistema" para esses casos (`entry.actorName ?? "Sistema"`);
a implementação corrige esse fallback para usar o nome do requerente (ver a decisão 4). O
contato do pedido público é sempre e-mail (obrigatório no schema); o do balcão pode ser telefone.

## Goals / Non-Goals

**Goals:**
- O cidadão que pede pelo site recebe a chave no e-mail, no momento em que o pedido nasce.
- O cidadão que perdeu a chave recupera sozinho, no site, sem falar com a serventia.
- O painel não tem mais nenhum caminho até a chave em claro de um pedido existente.
- Nenhuma regressão no que os avisos de andamento carregam (continuam sem conteúdo).
- A recuperação não vira oráculo: não confirma protocolo nem e-mail de ninguém.

**Non-Goals:**
- Tirar a chave da tela de sucesso, do comprovante ou do balcão.
- Recuperação sem e-mail (SMS, telefone).
- Mudar o formato da chave, o hash ou a rota de consulta.

## Decisions

### 1. Uma função própria para o e-mail que leva a chave, ao lado de `notifyCitizen`

`sendAccessKey({ tenant, contact, protocolNumber, accessKey, reason })` em
`src/lib/email/service-request.ts`, com `reason: "received" | "recovered"` escolhendo assunto e
corpo ("Pedido recebido" / "Nova chave de acesso"). Reaproveita, por função interna comum, a
checagem de devolução, o `after` e o `console.error` de `notifyCitizen`, e devolve o mesmo
`string | null` de aviso. `notifyCitizen` não ganha campo `accessKey`.

Alternativa: `NotifyCitizenParams.accessKey?` opcional. Descartada: o contrato de
`notifyCitizen` ("a mensagem nunca carrega o conteúdo") é o que protege os seis avisos de
andamento, e um campo opcional na mesma função convida o sétimo a levá-la. Com duas funções,
`grep sendAccessKey` lista os únicos lugares onde a credencial entra num e-mail.

### 2. Template próprio da credencial, com o mesmo cartão

`renderAccessKeyEmailHtml` e `renderAccessKeyEmailText` em `src/lib/email/render.ts`, com o
mesmo cabeçalho (selo, nome, subtítulo) e o mesmo botão "Consultar o protocolo" de
`renderNoticeEmailHtml`, e um bloco de credenciais: protocolo e chave em destaque, fonte
monoespaçada, espaçamento largo, cada um numa linha para o cidadão selecionar e copiar no
celular. Rodapé: "Guarde este e-mail: é com o protocolo e a chave que você acompanha o pedido.
Não compartilhe a chave." Na recuperação, duas frases a mais: "A chave anterior deixou de
valer." e "Se você não pediu uma chave nova, alguém informou o seu protocolo e o seu e-mail na
consulta; a chave só chega aqui, então o seu pedido continua só seu."

A chave NÃO entra no assunto (aparece em notificação de tela bloqueada e em listagens) nem no
link de consulta (a spec já proíbe chave em URL; o cidadão digita na consulta). O `text`
alternativo carrega o mesmo conteúdo.

Alternativa: estender `NoticeEmail` com `accessKey?` e ramificar o HTML. Descartada pela mesma
razão da decisão 1.

### 3. Recuperação no site: conferir em silêncio, trocar, enviar

`recoverAccessKeyAction` em `src/app/(public)/protocolo/actions.ts`, chamada pelo formulário
"Perdi a chave de acesso" com `protocolNumber` e `email`:

1. `isRateLimited` por IP (a mesma chave dos demais formulários públicos) **e** um limite por
   protocolo (3 recuperações por hora): a segunda barreira impede que alguém que conheça
   protocolo e e-mail de outra pessoa fique invalidando a chave dela em série.
2. Normaliza o protocolo (`REQ.AAAA.NNNNNN`, maiúsculas) e o e-mail (`trim`, minúsculas). Só
   protocolo de pedido de serviço; outros prefixos caem na resposta genérica.
3. `findByProtocol(tenant.slug, protocolNumber)`. Confere `contact` com o e-mail informado
   por `emailsMatch` no núcleo (`src/core/email/`: `trim` + minúsculas nos dois lados; nada de
   normalizar pontos ou `+`, o endereço que o cidadão deu é o que vale).
4. `findPermanentBounce(contact)`: com devolução, não troca a chave (a nova não chegaria e a
   atual, que talvez esteja num comprovante, pararia de valer).
5. `reissueAccessKey(tenant.slug, id, null)`: o ator é o cidadão.
6. `sendAccessKey({ reason: "recovered" })`.
7. Resposta **sempre** `{ status: "sent" }` com a mesma mensagem, em todos os ramos que não são
   erro de validação de formato ou rate limit: "Se o protocolo e o e-mail conferem, enviamos uma
   nova chave para esse endereço. Ela pode levar alguns minutos; confira também o spam." Quem
   errou o e-mail vê a mesma frase que quem acertou; o formulário não diz se o protocolo existe.

Alternativa: dizer "e-mail não confere". Descartada: viraria uma forma de testar pares
protocolo/e-mail. Alternativa: exigir também o CPF. Descartada: o CPF é opcional no pedido e o
e-mail já é a prova de posse que o sistema aceita para tudo o mais.

O que essa recuperação prova é posse do e-mail do pedido, não identidade: quem controla a caixa
recebe a chave. É o mesmo nível de garantia do "esqueci a senha" de qualquer serviço sem conta
forte, e é o nível que a plataforma já aceita ao mandar os avisos para lá.

### 4. O painel deixa de emitir chave

`reissueKeyAction` e `ReissueKeyState` são removidas. `KeySection` vira componente de servidor,
sem action: "Chave de acesso. Ativa desde <data>. Se o cidadão perder a chave, ele recupera
pelo site, na consulta de protocolo, com o e-mail do pedido." Quando o contato do pedido não é
e-mail, uma linha a mais: "Este pedido tem telefone como contato: atualize para um e-mail para o
cidadão poder recuperar a chave." A edição de dados já permite trocar o contato.

O formulário `POST …/imprimir` com `chave` sai da seção; a rota continua atendendo o POST
porque o balcão a usa. A auditoria `service-request.key-reissue` continua sendo a ação (o fato
é o mesmo: a chave anterior deixou de valer), com rótulo "recuperou a chave de acesso pelo
site" no histórico do detalhe e em `admin-overview.ts`. O autor: como o fallback de hoje
(`entry.actorName ?? "Sistema"`) mostraria "Sistema" para um evento sem ator, o histórico do
detalhe passa a cair no nome do requerente antes disso (`entry.actorName ?? request.applicantName
?? "Cidadão"`), o mesmo padrão que `admin-overview.ts` já usa (`entry.actorName ??
entry.applicantName ?? "Alguém"`) para a mesma situação.

Alternativa: manter um "Reenviar por e-mail" no painel como plano B. Descartada a pedido: a
responsabilidade sai da serventia; o plano B é o cidadão fazer no site. O que a serventia ainda
faz é corrigir o contato.

### 5. Site: o e-mail é a segunda via, a tela é a primeira

`createServiceRequestAction` troca o `notifyCitizen` do "Pedido recebido" por `sendAccessKey({
reason: "received" })`, ainda `await`ed pela checagem e sem exibir o aviso de devolução ao
cidadão (a tela ainda mostra a chave). O `success` da action passa a carregar `email` para a
tela dizer "Enviamos o protocolo e a chave também para maria@exemplo.com. Se não chegar em
alguns minutos, veja o spam ou baixe o comprovante abaixo." O aviso atual ("O site não guarda
nem reenvia") é substituído por esse. `ProtocolReveal` e o comprovante ficam.

Na consulta, `LostKeyNotice` vira `LostKeyForm`: o link "Perdi a chave de acesso" abre, na
mesma tela, os dois campos (protocolo pré-preenchido com o que já foi digitado na consulta,
e-mail) e o botão "Enviar nova chave". O WhatsApp e o telefone da serventia deixam de ser o
caminho da chave, mas continuam na página de contato.

### 6. Balcão: só o e-mail muda

`createManualRequestAction` troca o `notifyCitizen` do recibo por `sendAccessKey({ reason:
"received" })` quando o contato é e-mail (a função já devolve `null` para telefone, sem
tentativa). Tela, "copiar" e comprovante impresso não mudam: o cidadão está presente e pode não
ter e-mail. É a única tela do painel onde a chave continua aparecendo, e a spec diz isso.

### 7. Testes

- Unidade (`node --test`): `renderAccessKeyEmailHtml`/`Text` contêm protocolo e chave no corpo;
  a chave não está no assunto montado por `sendAccessKey`; `emailsMatch`.
- E2e `service-request.spec.ts`: a tela de sucesso diz para qual e-mail foi enviado; na
  consulta, "Perdi a chave de acesso" com protocolo e e-mail certos mostra a mensagem genérica
  e a chave antiga deixa de abrir o pedido; com e-mail errado, a mesma mensagem e a chave antiga
  continua abrindo. O envio em si não é verificável em e2e (sem `POSTMARK_SERVER_TOKEN` o
  `sendEmail` só registra no log).
- E2e `admin-service-requests.spec.ts`: o teste do comprovante hoje obtém uma chave válida
  clicando "Emitir nova chave"; passa a semear o pedido com chave conhecida (`hashAccessKey`,
  como `admin-lgpd.spec.ts`). Novo caso: o detalhe não tem "Emitir nova chave" nem texto no
  padrão da chave, e mostra a orientação; após a recuperação pelo site, o histórico registra
  "Cidadão recuperou a chave de acesso pelo site".

## Risks / Trade-offs

- [A chave passa a viver numa caixa de e-mail: quem acessa o e-mail acessa o pedido] → Aceito
  como decisão do produto: o e-mail é do próprio cidadão, o pedido já é notificado nele, e a
  alternativa real hoje é a chave ditada por telefone ou copiada pelo operador. Mitigações:
  chave fora do assunto, fora de URL, avisos de andamento continuam sem conteúdo, e o cidadão
  pode recuperar (o que invalida a que vazou).
- [Quem sabe protocolo e e-mail de outra pessoa invalida a chave dela] → A nova chave só vai
  para o e-mail do pedido, então o dono continua com acesso (na caixa dele) e o atacante não
  ganha nada. O limite por protocolo (3/h) impede o incômodo em série. O e-mail de recuperação
  avisa o que aconteceu se ele não pediu.
- [Recuperação: a chave é trocada e o envio, deferido em `after`, falha] → O cidadão pede de
  novo; a checagem de devolução antes da troca elimina a causa conhecida; o `console.error` é o
  sinal de que falhou.
- [Pedido de balcão com telefone e cidadão sem e-mail que perdeu a chave] → Sem caminho, de
  propósito: o cidadão volta ao balcão, o operador lança um e-mail no contato se houver um, e a
  recuperação pelo site passa a funcionar. Sem e-mail nenhum, o pedido segue pelo balcão, como
  seguia antes de existir chave.
- [`sendEmail` sem token de produção registra o texto do e-mail no log, chave incluída] → Só
  acontece sem `POSTMARK_SERVER_TOKEN`, fora de produção. Registrar no comentário de
  `sendEmail`.
- [Operador acostumado a "Emitir nova chave" procura o botão] → A seção da chave explica onde a
  recuperação acontece agora e o que o operador ainda pode fazer (corrigir o contato).
- [Sync das specs: `via-assinada-no-painel` ainda não foi arquivada e modifica "Imprimir o
  requerimento no balcão"] → O delta desta change parte do texto mais novo (o da via assinada).
  Arquivar `via-assinada-no-painel` antes desta, ou conferir o texto final ao arquivar.

## Migration Plan

Deploy único, sem banco. Pedidos antigos não são tocados: a chave que o cidadão já tem continua
válida; se ele a perdeu, a recuperação funciona para qualquer pedido cujo contato seja e-mail.
Rollback é reverter o deploy: as chaves já enviadas por e-mail continuam válidas, e o painel
volta a ter "Emitir nova chave".

## Open Questions

Nenhuma bloqueante. Premissa registrada: o balcão continua mostrando a chave (decisão 6).
