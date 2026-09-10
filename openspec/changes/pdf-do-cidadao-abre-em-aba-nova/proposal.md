## Why

Na tela de sucesso de `/solicitar`, "Baixar comprovante (PDF)" e "Baixar requerimento (PDF)" são
forms que fazem POST sem `target`, e a rota responde o PDF `inline`. O navegador navega a aba
atual para o PDF, por cima da única tela em que a chave de acesso aparece. O estado dessa tela
vive só na memória do React: ao voltar, o componente remonta com o formulário vazio e a chave se
foi — exatamente o que a própria tela avisa que não pode acontecer ("o comprovante abaixo é o
único lugar onde ela fica registrada"). O mesmo esquecimento está em mais dois botões da consulta
de protocolo, enquanto outros dois, nas mesmas telas, já abrem em aba nova.

## What Changes

- Os dois downloads da tela de sucesso de `/solicitar` passam a abrir em aba nova, e a tela com
  protocolo e chave permanece onde está.
- O download do requerimento nas duas consultas de protocolo (`/protocolo` e `/acompanhar`, no
  passo "Baixe o requerimento preenchido") passa a abrir em aba nova, igual aos dois botões
  vizinhos que já fazem isso.
- Um e2e passa a clicar no botão e conferir que uma aba nova abriu e que a tela de origem ainda
  mostra a chave — hoje a suíte só chama a rota por `request.post`, e nenhum dos quatro botões é
  exercitado.

## Non-goals

- Não muda a rota `/solicitar/requerimento` nem o `Content-Disposition: inline`. Trocar para
  `attachment` também resolveria, mas no celular manda o arquivo para a pasta de downloads em vez
  de mostrá-lo na hora, e metade dos botões já escolheu a aba nova.
- Não toca nos botões do painel (`/admin/pedidos/novo`, detalhe do pedido, seção da chave): os
  três já abrem em aba nova.
- Não unifica o `ProtocolFields` duplicado em `request-form.tsx` e `protocol-lookup.tsx`. É o que
  permitiria o esquecimento acontecer em quatro lugares, mas é refatoração à parte.
- Não mexe na CSP nem nos headers de segurança: a investigação começou por eles e eles não têm
  parte nisto.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: o requisito "Requerimento em PDF e envio do assinado" passa a exigir que os
  downloads abram em aba nova, sem tirar o cidadão da tela que mostra a chave.

## Impact

- `src/app/(public)/solicitar/request-form.tsx`: os dois forms da tela de sucesso.
- `src/app/(public)/protocolo/protocol-lookup.tsx` e `src/app/(public)/acompanhar/protocol-trilho.tsx`:
  o form do requerimento no passo "Baixe o requerimento preenchido".
- `e2e/service-request.spec.ts`: teste novo que clica nos botões.
- Sem migração de banco, sem mudança de rota.
