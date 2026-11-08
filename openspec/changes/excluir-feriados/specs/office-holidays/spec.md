## ADDED Requirements

### Requirement: Serventia exclui feriado da lei

Cada feriado da lei SHALL ter, no painel, os botões "Alterar", "Não fecha aqui" e "Excluir".
"Excluir" SHALL tirar o feriado da lista do painel e da conta de dias úteis, em todos os anos,
gravando só na configuração da serventia, sem apagar a regra da lei. "Não fecha aqui" SHALL
manter o feriado na lista, riscado, com "Voltar a considerar".

#### Scenario: Excluir

- **WHEN** a serventia exclui a Véspera de Natal e salva
- **THEN** 24/12 deixa de fechar a serventia e o feriado não aparece mais na lista

#### Scenario: Não fecha aqui continua

- **WHEN** a serventia marca "Não fecha aqui" no São Pedro
- **THEN** ele fica na lista, riscado, com "Voltar a considerar"

### Requirement: Feriado próprio registra a lei que o cria

Um feriado cadastrado pela serventia SHALL poder ser marcado como "Feriado por lei", com o texto
da lei (até 120 caracteres). Marcado sem o texto, SHALL ser recusado com "Informe a lei que cria
o feriado.".

#### Scenario: Recolocar um feriado excluído por engano

- **WHEN** a serventia cadastra "São Pedro" em 29/06, todo ano, marca "Feriado por lei" e informa a lei
- **THEN** 29/06 volta a fechar a serventia e a lei fica registrada no feriado

#### Scenario: Lei em branco

- **WHEN** "Feriado por lei" está marcado e o campo da lei está vazio
- **THEN** nada é gravado e a linha mostra "Informe a lei que cria o feriado."
