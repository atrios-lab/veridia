## ADDED Requirements

### Requirement: A Átrios acompanha o uso e as conversas de todas as serventias

A área da Átrios no painel SHALL ter a tela `/admin/atrios/assistente-dpo`, acessível só ao
cargo `superadmin` e verificada no servidor. A tela SHALL listar cada serventia com:

- o uso do mês corrente;
- o teto do mês;
- a quantidade de conversas;
- a data da última pergunta.

A partir de uma serventia, a Átrios SHALL poder abrir a lista de conversas e ler cada uma como
foi gravada, já com os dados ocultados. Cada conversa SHALL vir com o cargo de quem perguntou e a
data. A tela NÃO SHALL oferecer edição nem exclusão de mensagens.

#### Scenario: Superadmin lê uma conversa

- **WHEN** uma conta `superadmin` abre uma serventia em `/admin/atrios/assistente-dpo` e escolhe
  uma conversa
- **THEN** vê as mensagens como foram gravadas, com os marcadores no lugar dos dados ocultados

#### Scenario: Registrador não entra

- **WHEN** um Tabelião/Registrador abre `/admin/atrios/assistente-dpo` pelo endereço
- **THEN** a rota recusa o acesso

### Requirement: A Átrios ajusta o teto mensal por serventia

Na mesma tela, a Átrios SHALL poder definir o teto mensal de uma serventia. Uma serventia sem
valor próprio SHALL usar o padrão de 300 perguntas. A mudança SHALL valer de imediato para o mês
corrente e SHALL ficar registrada na auditoria, com o valor anterior e o novo.

#### Scenario: Teto aumentado no meio do mês

- **WHEN** a serventia atingiu 300 perguntas e a Átrios define o teto dela em 500
- **THEN** a próxima pergunta da serventia é respondida, e a auditoria registra a mudança de 300
  para 500
