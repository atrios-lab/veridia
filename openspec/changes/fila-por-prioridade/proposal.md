## Why

A fila de `/admin/pedidos` lista por data de criação, do mais novo ao mais antigo. Quem abre a
tela quer saber o que precisa de mão agora, e a data não diz isso: um "Concluído" de ontem fica
acima de uma exigência vencida há uma semana, e o operador varre a lista inteira todo dia para
achar o que travou.

## What Changes

- A fila passa a ser lida em bandas, de cima para baixo: Com pendência, Aguardando, Em andamento,
  Para retirada, Encerrados. Cada banda ganha um cabeçalho com o nome e a quantidade.
- A banda de um pedido vem do mesmo tom que colore o selo do andamento (o que o andamento pede da
  serventia), com uma correção: todo andamento terminal vai para Encerrados, mesmo o "Indeferido",
  que é vermelho.
- Dentro de uma banda aberta: prazo vencido primeiro (o mais atrasado no topo), depois os que
  vencem em breve (o mais próximo no topo), depois os demais por ordem de chegada, do mais antigo
  ao mais novo, que é a ordem que a serventia promete ao cidadão.
- Em Encerrados a ordem é do mais novo ao mais antigo.
- Quando só uma banda aparece (filtro por um andamento, por exemplo), o cabeçalho não é mostrado.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-service-requests`: o requisito "Fila de pedidos filtrável e pesquisável" troca a ordem
  decrescente de criação pela leitura em bandas por prioridade.

## Impact

- `src/app/admin/(dashboard)/pedidos/page.tsx`: calcula banda e urgência por linha, ordena e
  insere os cabeçalhos de banda.
- `src/app/admin/(dashboard)/pedidos/_components/queue-order.ts`: bandas, rótulos e comparador.
- Nenhuma mudança de banco, consulta ou filtro.

## Non-Goals

- Não muda os filtros, a busca nem as colunas da fila.
- Não muda cores nem rótulos dos andamentos.
- Não oferece ao operador escolher a ordem (por data, por nome): uma ordem só, a que a serventia
  trabalha.
- Não muda a Visão geral nem as outras filas (LGPD, ouvidoria, agenda).
