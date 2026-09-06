## ADDED Requirements

### Requirement: E-mail de boas-vindas ao administrador convidado pela plataforma

O sistema SHALL enviar o e-mail de boas-vindas da plataforma, em vez do convite comum, sempre
que a conta for criada, ou o convite reenviado, por um usuário com papel `superadmin`. O e-mail SHALL: (a) usar a identidade visual da serventia (selo, nome e
subtítulo do tenant) e nomear a serventia no assunto e no corpo; (b) dizer quem convidou e o
papel da conta; (c) explicar em um parágrafo como o painel ajuda a serventia a se enquadrar no
Provimento CN-CNJ n. 213/2026 e na LGPD, afirmando apenas o que a plataforma entrega (conta
individual por colaborador, auditoria de cada ação, canais de ouvidoria e de direitos do
titular no site); (d) conter um único botão que leva ao link de primeiro acesso, válido por 48
horas e de uso único, pelo qual a pessoa cria a própria senha antes de entrar. O e-mail MUST
NOT conter senha alguma, temporária ou não.

Quando quem cria ou reenvia é um Registrador ou Operador da serventia, o sistema SHALL
continuar enviando o convite comum já existente.

#### Scenario: Superadmin cria a conta do Registrador de uma serventia

- **WHEN** um `superadmin`, no painel da serventia A, cria uma conta com papel Registrador
- **THEN** o e-mail enviado tem o assunto de boas-vindas nomeando a serventia A, o selo e o
  subtítulo dela, menciona o Provimento 213 e a LGPD, e traz o botão de criar a senha apontando
  para o link de primeiro acesso

#### Scenario: Superadmin reenvia o convite

- **WHEN** um `superadmin` aciona "Reenviar convite" para uma conta em "Aguardando 1º acesso"
- **THEN** o link anterior é invalidado e o e-mail reenviado é o de boas-vindas, com o link novo

#### Scenario: Registrador cria a conta

- **WHEN** um Registrador da serventia cria uma conta ou reenvia um convite
- **THEN** o e-mail enviado é o convite comum ("Seu acesso ao painel administrativo"), sem
  alteração

#### Scenario: Nenhuma senha no e-mail

- **WHEN** o e-mail de boas-vindas é montado
- **THEN** nenhum parágrafo, botão ou rodapé contém uma senha; o acesso provisório é
  exclusivamente o link de 48 horas

#### Scenario: Primeiro acesso pelo link de boas-vindas exige criar a senha

- **WHEN** o administrador abre o link do e-mail de boas-vindas dentro de 48 horas
- **THEN** o sistema mostra a tela de primeiro acesso, sem liberar o painel até a senha ser
  criada, e ao criá-la entra no painel
