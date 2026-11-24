## Por quê

Hoje um pedido não diz, dentro do cartório, com quem ele está. Quem pegou, para quem foi mandado conferir ou assinar e quem deu cada andamento fica na cabeça das pessoas. O dono do projeto pediu (23/11/2026 e 24/11/2026):

- quem pegou o pedido pode transferi-lo a outro funcionário ou a um setor, e quem recebe é avisado;
- todos veem com quem o pedido está, e fica registrado quem deu andamento sem ser o responsável;
- a transferência diz para quê (executar um serviço das atribuições da serventia, conferência ou assinatura), com prioridade, prazo e recado;
- pode ser alterada, desfeita e redirecionada;
- "Pegar para mim" sem bloqueio: livre, com aviso a quem estava e histórico;
- o Tabelião escolhe quem pode assinar e concluir os pedidos (todos, ou só quem ele selecionar), e quem ele autorizar (e a Átrios) também pode decidir isso;
- setores já prontos (as atribuições, Balcão, Caixa, Gabinete do Tabelião), que o Tabelião edita, cria e apaga;
- direcionar ao setor sem escolher a pessoa cai na fila do setor;
- o cidadão vê o andamento de sempre e uma linha automática ("Com o setor de Registro Civil · aguardando assinatura"), que pode ser desligada; desligada, fica como hoje;
- nada disso volta à "Sua mesa": a mesa continua só para o movimento entre o cartório e o cidadão.

## O que muda

- Tabela nova `service_request_routings` (só criação), com cada direcionamento e o seu ciclo: criado, recebido, alterado, desfeito.
- Regras puras em `src/core/routing/` (setores padrão, com quem está o pedido, a linha do cidadão, quem pode concluir), com testes.
- Pedido: cartão "Direcionamento" na lateral, janela "Direcionar", "Pegar para mim" e "Devolver"; o histórico marca o andamento dado por quem não era o responsável.
- Menu "Direcionados a mim" com contador, página com o que está comigo e na fila dos meus setores, e alerta próprio (canal "Direcionamentos" em Configurações › Notificações).
- Configurações › Setores e Configurações › Assinatura e conclusão, com a permissão nova `routing.settings`.
- Concluir o pedido ("Ato praticado: disponibilizar para retirada", "Concluir com entrega digital", responder a busca) passa a respeitar a escolha de quem pode assinar e concluir.
- Consulta do cidadão: a linha do setor e da fase interna, quando ligada.

## O que não muda

- Os andamentos, a regra da "Sua mesa" e o que o cidadão vê com a linha desligada.
- Nenhuma tabela ou coluna existente é apagada ou alterada.
