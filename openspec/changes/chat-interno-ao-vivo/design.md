## Context

O mensageiro interno consultava o servidor por ações de servidor a cada 3 s (tela de mensagens), 4 s (vigia em todas as telas) e 3 s (janela flutuante). Ações de servidor de uma mesma página rodam uma de cada vez, então o envio esperava atrás de uma consulta em andamento; com a aba em segundo plano, o navegador espaça os temporizadores para até um por minuto.

## Goals / Non-Goals

**Goals:** entrega e "digitando" em menos de um segundo, também com a aba fora de vista; sem serviço pago novo; nada apagado do banco.

**Non-Goals:** conversa em grupo; busca dentro do texto de todas as conversas; WebSocket.

## Decisions

1. **SSE com uma consulta leve por segundo, no servidor.** A rota `eventos` mantém a conexão por 50 s (o navegador reabre sozinho) e, a cada ~0,9 s, lê uma "versão" (última mensagem, edição, exclusão, reação e leitura do outro) e quem está digitando. Mudou, avisa `change`; o cliente então busca o que mudou. Sem Postgres LISTEN (o pooler em modo transação não o suporta) e sem Redis.
2. **Uma conexão por aba.** `messenger-live.ts` guarda um único EventSource, compartilhado pelo vigia, pela tela de mensagens e pela janela flutuante. Com a conexão ativa, as consultas periódicas viram rede de segurança a cada 20 s.
3. **Leitura só grava quando há o que ler.** `markReadWith` regrava `last_read_at` apenas se houver mensagem nova do outro; senão, duas telas abertas mudariam a versão uma da outra sem parar.
4. **"Digitando" é um aviso, não histórico.** Duas colunas em `messenger_profiles` (conversa e hora), sobrescritas a cada 2,5 s e lidas só enquanto têm menos de 6 s. O aviso vai por rota comum (não ação de servidor) para nunca segurar uma mensagem na fila.
5. **Reação sem apagar.** Uma linha por pessoa e mensagem; desfazer grava `removed_at`. Sem chave estrangeira, porque a limpeza da demonstração apaga as mensagens e mantém esta tabela.
6. **Som decidido num lugar só.** O vigia toca para qualquer mensagem, pelas regras da pessoa (`toneFor`): "não perturbe", aba fora de vista, conversa aberta na tela, som próprio ou o da serventia, e o do "Chamar atenção".

## Risks / Trade-offs

- Cada pessoa com o painel aberto faz uma consulta leve por segundo ao banco. Para a equipe de um cartório é pouco; se crescer, o intervalo sobe para 2 s sem mudar nada mais.
- Se a hospedagem cortar a conexão antes de 50 s, o navegador reabre em 1 s; enquanto isso, a rede de segurança cobre.
