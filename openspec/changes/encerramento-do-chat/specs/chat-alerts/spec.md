## ADDED Requirements

### Requirement: Encerramento diz quem encerrou e sempre deixa fechar

Quando a conversa é encerrada, o chat do site SHALL dizer quem encerrou (o próprio cidadão, o
atendente pelo nome, ou a falta de resposta) e SHALL oferecer "Fechar", que sai sem avaliar e
deixa o chat pronto para uma conversa nova; a avaliação SHALL ser opcional. O X do cabeçalho
nessa tela SHALL fazer o mesmo que "Fechar". O painel SHALL dizer, na conversa encerrada, se foi
o cidadão, o atendimento ou a inatividade, e SHALL oferecer "Voltar para a fila" e "Fechar",
no lugar dos botões da conversa e da caixa de mensagem, que não servem mais.

#### Scenario: Cartório encerra

- **WHEN** o atendente encerra a conversa
- **THEN** o cidadão vê "<nome> encerrou este atendimento." e o botão "Fechar"

#### Scenario: Cidadão encerra com o atendente na conversa

- **WHEN** o cidadão encerra enquanto o atendente está com a conversa aberta
- **THEN** em segundos o painel troca os botões e a caixa de mensagem por "Conversa encerrada pelo cidadão." com "Voltar para a fila" e "Fechar"

#### Scenario: Cidadão fecha sem avaliar

- **WHEN** o cidadão clica em "Fechar" na tela final
- **THEN** o chat volta ao formulário de início, sem a conversa encerrada

### Requirement: Cidadão informa o motivo antes de desistir

Ao encerrar a conversa pelo site, o cidadão SHALL escolher um motivo de uma lista fixa antes de
confirmar, podendo detalhar em até 300 caracteres. O motivo SHALL ficar numa linha de sistema da
conversa, visível ao atendente. A tela do motivo e a tela final SHALL mostrar o e-mail de
contato da serventia para dúvidas.

#### Scenario: Sem motivo

- **WHEN** o cidadão ainda não escolheu um motivo
- **THEN** o botão "Encerrar atendimento" fica desabilitado

#### Scenario: Atendente lê o motivo

- **WHEN** o cidadão encerra com "Resolvi de outra forma" e um detalhe
- **THEN** a conversa no painel mostra "Motivo do encerramento pelo cidadão: Resolvi de outra forma." seguido do detalhe
