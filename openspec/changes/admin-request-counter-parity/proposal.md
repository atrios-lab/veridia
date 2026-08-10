## Why

O Veridia substitui o painel legado do Cartório Marinho, e a comparação tela a tela do detalhe do pedido mostrou três capacidades que o balcão usa todo dia e que o painel novo não tem. Sem elas, a serventia não migra: não consegue imprimir o requerimento para o cidadão assinar no balcão, não corrige um erro de digitação depois de protocolar (cancela e refaz), e não tem como entregar ao cidadão o formulário que uma exigência pede.

## What Changes

- **Imprimir no balcão**: o detalhe do pedido ganha a ação "Imprimir folha" — o requerimento em PDF gerado pela sessão do painel, sem exigir a chave de acesso. Quando o cidadão já devolveu o requerimento assinado, a mesma ação vira "Imprimir via assinada" e abre o arquivo assinado. Enquanto uma chave recém-emitida está na tela, o painel também oferece o comprovante de acesso para imprimir e entregar em papel.
- **Editar dados do pedido**: nome, contato, CPF, finalidade, descrição e a **data/hora do atendimento** passam a ser corrigíveis no detalhe, com trilha no histórico. A data é editável porque o balcão lança o atendimento depois, e o protocolo vale pelo momento do atendimento. O ato fica de fora: trocá-lo muda atribuição e base legal do que já foi protocolado — cancela e abre outro.
- **Formulário anexado à exigência**: a serventia pode anexar a uma exigência o formulário que o cidadão deve imprimir e apresentar. O arquivo fica preso à exigência — aparece no cartão dela na consulta do cidadão, não entra em "Documentos da serventia" nem no prazo de 30 dias dessa lista.
- **Não-objetivos**:
  - Não muda a fila de pedidos, o wizard público nem os canais (LGPD, ouvidoria, agenda).
  - Não traz da tela legada: cartão "Próximo passo", ação primária única no topo, marcar exigência cumprida pelo balcão, tamanho de arquivo nas linhas, separação de anexos por origem — fatias futuras.
  - Não permite editar o ato nem o protocolo do pedido.
  - Não armazena a chave de acesso em claro em lugar nenhum; o comprovante imprimível existe só enquanto a chave reemitida está na tela.
  - Não cria editor de PDF: a folha impressa é o mesmo requerimento que o cidadão baixa.

## Capabilities

### New Capabilities
<!-- Nenhuma. -->

### Modified Capabilities
- `admin-service-requests`: o detalhe do pedido ganha impressão do requerimento/via assinada, correção dos dados protocolados e formulário anexável à exigência. (A spec desta capability vive na change `add-admin-service-requests`, implementada e ainda não arquivada; este delta é só de requisitos ADDED.)
- `service-request`: o cartão de exigência na consulta do cidadão passa a oferecer o formulário anexado pela serventia.

## Impact

- Novo `GET src/app/admin/(dashboard)/pedidos/[protocolo]/imprimir/route.ts` (ou rota admin equivalente): monta `buildRequerimento` com a marca do tenant, autenticado por sessão + `requests.manage`.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/`: ação de imprimir no topo, formulário de edição em "Dados do solicitante", upload de formulário no cartão de exigência; novas server actions (`updateRequestDataAction`, `attachRequirementFormAction`).
- `src/lib/service-request.ts`: atualização dos dados do pedido com auditoria; vínculo exigência→formulário.
- `src/db/schema.ts`: coluna nova e anulável em `service_request_attachments` (`requirement_id`) — migração expand, deploy único.
- `src/app/(public)/protocolo/`: o cartão da exigência lista e baixa o formulário (a rota pública de documento já serve qualquer anexo do pedido mediante chave).
- `src/core/request/`: sem mudança de regra; `buildRequerimento` é reusado como está.
