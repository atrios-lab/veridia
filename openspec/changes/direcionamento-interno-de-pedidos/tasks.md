## 1. Antes de começar

- [x] 1.1 Pedido do usuário (23 e 24/11/2026), ideia em imagem aprovada, decisões sobre setores, fila, pegar sem bloqueio, quem conclui e linha do cidadão

## 2. Regras e banco

- [x] 2.1 `src/core/routing/`: setores padrão, com quem está o pedido, linha do cidadão, quem pode concluir, com testes
- [x] 2.2 Tabela `service_request_routings` e migração só de criação; mantida na limpeza do cartório de demonstração
- [x] 2.3 Serviço `src/lib/routing.ts`: direcionar, pegar, receber, alterar, desfazer, devolver, setores, política de conclusão, linha do cidadão, com testes no banco de teste
- [x] 2.4 Permissão `routing.settings`, rótulos de auditoria e gravidade

## 3. Painel

- [x] 3.1 Cartão "Direcionamento" na lateral do pedido e janela "Direcionar"
- [x] 3.2 "Direcionados a mim": menu com contador, página e alerta (canal "Direcionamentos")
- [x] 3.3 Configurações › Setores e Configurações › Assinatura e conclusão
- [x] 3.4 Trava de conclusão no andamento e na resposta da busca
- [x] 3.5 Histórico marca andamento dado por quem não era o responsável

## 4. Cidadão

- [x] 4.1 Linha do setor e da fase na consulta, desligável na serventia e no pedido

## 5. Entrega

- [x] 5.1 Imagens das telas, bateria completa, PR e merge
