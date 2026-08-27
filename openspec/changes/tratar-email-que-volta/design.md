## Context

Todo e-mail do sistema sai por `sendEmail` (`src/lib/email/send.ts`): convite, nova senha,
agendamento, exigência, ouvidoria. É funil único, o que já foi usado uma vez —
`EMAIL_REDIRECT_TO` decide ali para onde a mensagem vai — e é o mesmo ponto onde cabe decidir se
ela sai.

O que o sistema não tem hoje é o caminho de volta. O Postmark sabe que a mensagem voltou; a
aplicação não fica sabendo de nada. O provedor oferece webhook para isso, e a conta já tem a aba
Webhooks configurável.

Um detalhe do provedor que molda o desenho: depois de um hard bounce o Postmark **suprime** o
endereço e passa a recusar envios para ele com 422 / `ErrorCode 406`. Ou seja, hoje a segunda
tentativa já falha — só que falha como "o provedor não aceitou o envio", frase que não distingue
"essa caixa não existe" de "o provedor está fora do ar", e que manda o atendente tentar de novo
uma coisa que nunca vai funcionar.

## Goals / Non-Goals

**Goals:**
- Não perder mais a informação de que uma mensagem voltou.
- Recusar o envio seguinte para aquele endereço, com o motivo real na tela de quem tentou.
- Guardar o retorno de forma que qualquer tela possa consultar depois, sem migração nova.

**Non-Goals:**
- Validar no formulário se a caixa existe.
- Marcadores passivos nas telas.
- Reenvio automático ou correção automática de cadastro.

## Decisions

**A tabela é indexada pelo endereço, não pelo registro que o continha.** O mesmo e-mail aparece
em `service_requests.contact`, `appointments.email`, `chat_conversations.citizen_contact` e
`user.email` — quatro colunas em quatro tabelas, sem nada em comum. Guardar o retorno em cada uma
significaria quatro migrações, quatro caminhos de escrita e a mesma pergunta respondida de quatro
jeitos. Uma tabela com o endereço como chave responde "esse endereço volta?" para todas de uma
vez, e é exatamente a pergunta que o envio precisa fazer. Alternativa descartada: uma coluna
`bounced_at` em cada tabela, que além do custo acima erra o modelo — quem devolve é a caixa, não
o pedido.

**A recusa mora em `sendEmail`, junto do desvio de teste.** É o único ponto por onde todos os
envios passam, então é o único lugar onde a regra não precisa ser lembrada em cada chamador novo.
Um envio recusado lança, como já lança a resposta não-2xx do Postmark, e cada action decide o que
mostrar — mas lança um erro reconhecível, não uma string, para que a action consiga distinguir
"caixa não existe" de "provedor fora do ar" e dizer a coisa certa.

**Recusar antes de chamar o provedor, e não deixar o provedor recusar.** O resultado prático é o
mesmo (a mensagem não sai), mas há três diferenças: a chamada de rede não acontece, a tentativa
não conta na taxa de rejeição da conta — que é o número que, passando de 10%, cala todas as
serventias —, e o motivo que chega à tela é o do bounce original ("caixa não existe"), não o
genérico do provedor.

**Só hard bounce e supressão bloqueiam.** O Postmark distingue dezenas de tipos. "Caixa cheia",
"resposta automática de férias" e "conteúdo recusado por filtro" não significam que o endereço
não existe, e bloquear neles trancaria o cidadão fora por algo temporário. O tipo fica gravado
para todos, mas só a família permanente decide a recusa.

**O webhook é autenticado por segredo comparado em tempo constante.** Endpoint público que grava
no banco sem autenticação é endpoint que qualquer um usa para bloquear o e-mail de quem quiser:
bastaria postar o endereço de uma pessoa para o painel parar de escrever para ela. O segredo vem
de variável de ambiente; sem ela configurada, o endpoint recusa tudo em vez de aceitar tudo, que
é a direção segura para um padrão que já existe no repositório (`sendEmail` sem token não envia,
`isRateLimited` sem Upstash não limita — mas nenhum dos dois abre uma porta).

**O corpo do webhook é dado, nunca instrução.** Vem de fora, atravessa `Zod` antes de encostar no
banco, e só os campos declarados são gravados. A descrição do provedor é texto do provedor e é
exibida como texto.

**Sem desbloqueio pela tela, por enquanto.** Se a caixa for consertada, o endereço continua
recusado até alguém tirar da tabela. É um caso que ainda não aconteceu nenhuma vez, e a saída que
existe hoje — trocar o e-mail do cadastro — resolve o mesmo problema sem tela nova. Quando
acontecer, é um botão sobre uma tabela que já vai estar lá.

## Risks / Trade-offs

- **Um bounce grava um bloqueio permanente para aquele endereço** → Mitigado pela restrição a
  tipos permanentes, e o registro guarda o tipo e a descrição, então desfazer é apagar uma linha
  com o motivo à vista.
- **Endereço compartilhado por várias pessoas** (a caixa da serventia usada como login e como
  contato) → É o comportamento correto: se a caixa não recebe, não recebe para ninguém.
- **O webhook pode não estar configurado no Postmark** → A tabela fica vazia e o sistema se
  comporta exatamente como hoje. Nada quebra por ausência, o que também significa que o passo de
  operação precisa estar escrito onde alguém vá ler.
