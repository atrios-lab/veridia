## Why

Na fila de `/admin/pedidos` o andamento "Pago" cai na banda "Em andamento", misturado com o que
já está sendo trabalhado (em análise, prenotado, em qualificação) e ordenado por chegada entre
eles. Um pedido pago é dinheiro recebido e trabalho ainda por fazer: o cidadão cumpriu a parte
dele e o balcão ainda não pegou. A serventia pediu (SCRUM-38) que "Pago" fique no alto da
fila, junto com as exigências e os pedidos novos, para ler de uma vez o que é novo, o que está
atrasado e o que já foi pago.

## What Changes

- "Pago" passa da banda "Em andamento" para a banda "Aguardando", ao lado de "Novo",
  "Protocolado" e "Aguardando pagamento": tudo que espera o balcão pegar (ou o cidadão pagar).
- Dentro de "Aguardando" a ordem não muda: prazo vencido primeiro, depois vence em breve, depois
  chegada do mais antigo ao mais novo. Um "Pago" atrasado sobe como qualquer outro.
- "Em andamento" fica só com o que já está em trabalho na serventia.
- O selo de "Pago" continua verde: a cor diz que o dinheiro entrou, a banda diz que ainda
  falta a mão do balcão.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: o requisito "Fila de pedidos filtrável e pesquisável" move "Pago"
  de "Em andamento" para "Aguardando".

## Impact

- `src/app/admin/(dashboard)/pedidos/_components/queue-order.ts`: `queueGroupOf` devolve
  `waiting` para `paid`.
- `src/app/admin/(dashboard)/pedidos/_components/queue-order.test.ts`: cobre a exceção.
- Nenhuma mudança de banco, consulta, filtro, cor de selo ou Visão geral.

## Non-Goals

- Não muda a cor nem o rótulo de "Pago" nem de nenhum andamento.
- Não muda a ordem entre as bandas: "Com pendência" segue acima de "Aguardando".
- Não cria banda nova ("Pagos", por exemplo) nem separa "Novo" de "Pago" dentro de
  "Aguardando": o selo já distingue os dois.
- Não muda o cabeçalho, os filtros, a busca nem as colunas da fila.
- Não toca nas outras filas (LGPD, ouvidoria, agenda) nem na Visão geral.
