## Why

O cidadão termina o pedido e acha que acabou: o passo de baixar e assinar o requerimento tem o mesmo peso visual dos outros, e escolher qualquer arquivo já o envia, sem chance de conferir. A serventia recebe pedidos sem requerimento assinado, ou com outro documento no lugar, e a própria tela reforça o engano ao dizer "o pedido não trava".

## What Changes

- Na tela de sucesso, o passo 2 (baixar e assinar) ganha uma faixa sólida de "obrigatório", o aviso de que o pedido só prossegue com o requerimento assinado e uma borda vermelha piscando. A borda para de piscar quando o cidadão baixa o requerimento e fica fixa até o envio.
- Na tela de sucesso, o passo 3 (enviar) ganha borda vermelha fixa, sem piscar.
- **BREAKING (fluxo do cidadão)**: escolher o arquivo deixa de enviá-lo. O envio passa a ter duas etapas: escolher o arquivo e, com o nome dele na tela, marcar a confirmação de que é o documento deste pedido já assinado, ler o aviso de que documento diverso faz o pedido não tramitar, e só então clicar em "Enviar".
- A confirmação vale nos três pontos de envio: tela de sucesso, `/protocolo` e `/acompanhar`, para o requerimento e para a declaração de hipossuficiência. A ação `attachSignedForm` recusa envio sem a confirmação.
- O `SignCard` de `/acompanhar` deixa de ter uma cópia própria do envio e passa a usar o `SignedFormUpload`.
- Saem as frases "o pedido não trava" (`/protocolo`) e "Seu pedido continua valendo" (`/acompanhar`). No lugar, o texto diz que o balcão continua valendo, mas que sem o requerimento assinado o pedido não tramita.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: o requisito "Requerimento em PDF e envio do assinado" passa a separar registro de tramitação; entram requisitos para o aviso de que o pedido não tramita sem o assinado, para a confirmação antes do envio e para o destaque dos passos na tela de sucesso.

## Non-goals

- Bloquear o pedido no painel: o operador continua podendo mover um pedido sem o assinado. "Não tramita" é a regra da serventia comunicada ao cidadão, não uma trava do sistema.
- Verificar se o arquivo está de fato assinado ou se é mesmo o requerimento. A confirmação é uma declaração do cidadão; quem confere é a serventia.
- Gravar a confirmação no banco. Não há coluna nova nem migração.
- Oferecer o envio da declaração em `/acompanhar`, que hoje só tem o download dela. A troca pelo `SignedFormUpload` mantém esse escopo.
- Fazer a borda piscar em `/protocolo` ou `/acompanhar`. Só a tela de sucesso pisca.
- Mudar o texto do PDF do requerimento ou os e-mails.

## Impact

- `src/app/(public)/solicitar/request-form.tsx`: destaque dos passos 2 e 3 em `SuccessScreen` e `Step`.
- `src/app/(public)/_components/signed-form-upload.tsx`: envio em duas etapas.
- `src/app/(public)/acompanhar/protocol-trilho.tsx`: `SignCard` passa a usar o componente; aviso e texto do balcão.
- `src/app/(public)/protocolo/protocol-lookup.tsx`: aviso e texto do balcão.
- `src/app/(public)/solicitar/actions.ts`: `attachSignedForm` exige a confirmação.
- `src/core/request/attachment.ts` e `src/core/request/requerimento.ts`: regra da confirmação e textos.
- `src/app/globals.css`: animação da borda.
- Banco: nenhuma mudança. Sem migração de produção.
- Alcance: o aviso vale para todas as serventias, porque o texto é único.
