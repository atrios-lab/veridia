## ADDED Requirements

### Requirement: Edição dos feriados da serventia

A aba Serventia de Configurações SHALL ter a seção "Feriados e dias sem expediente", visível a
quem tem `content.edit`. Ela SHALL mostrar os dias já considerados por lei (nacionais e do Código
de Normas do estado) nos próximos 12 meses e SHALL permitir adicionar, editar e remover feriados
próprios (nome, data, "Todo ano"). Salvar SHALL validar no servidor com o schema de
`customHolidays`, gravar a lista inteira como override da serventia e registrar entrada em
`audit_log`.

#### Scenario: Dias da lei visíveis

- **WHEN** o usuário abre a seção
- **THEN** vê, por exemplo, 12/10 Nossa Senhora Aparecida e 24/06 São João entre os dias já
  considerados, sem precisar cadastrá-los

#### Scenario: Feriado sem nome é recusado

- **WHEN** o usuário salva uma linha sem nome
- **THEN** nada é gravado e a linha mostra "Dê um nome ao feriado."

#### Scenario: Data que não existe é recusada

- **WHEN** a data enviada é 30/02
- **THEN** nada é gravado e a linha mostra "Informe uma data que exista."

#### Scenario: Atalhos de nome

- **WHEN** o usuário toca em "+ Dia do Evangélico"
- **THEN** uma linha nova aparece com esse nome e "Todo ano" marcado, faltando só a data

#### Scenario: Gravação vale no site

- **WHEN** a serventia salva um feriado para amanhã
- **THEN** o cartão de horário da home passa a dizer que abre no dia útil seguinte
