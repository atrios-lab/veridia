## 1. Antes de começar

- [x] 1.1 Pedido do usuário (19/11/2026): ao anexar o documento final, perguntar entrega digital ou retirada no balcão e, no balcão, registrar quem retirou (CPF etc.)

## 2. Regras e banco

- [x] 2.1 `src/core/request/pickup.ts`: estados do cartão, jeitos de fechar, quem retirou, validação do CPF e documento mostrado, com testes
- [x] 2.2 Tabela `service_request_pickups` e migração só de criação; tabela mantida na limpeza da demonstração
- [x] 2.3 Serviço `src/lib/request-pickup.ts` com testes no banco de teste: registrar, concluir, recusas, outro cartório
- [x] 2.4 Auditoria `service-request.pickup`

## 3. Painel

- [x] 3.1 Ações `closeDeliveryAction` e `registerPickupAction`, com aviso por e-mail ao cidadão
- [x] 3.2 Cartão no detalhe do pedido: a pergunta, o aviso de documento retido, o formulário de quem retirou e o resumo da retirada

## 4. Entrega

- [x] 4.1 Bateria completa, PR e merge
