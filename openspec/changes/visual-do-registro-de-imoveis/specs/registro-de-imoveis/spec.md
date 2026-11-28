## ADDED Requirements

### Requirement: Protocolo com o trabalho do dia em primeiro lugar
O sistema DEVE (SHALL) abrir o Protocolo com a faixa do dia (próximo número, folha e dias a encerrar), os números do dia e a lista de títulos, e DEVE (SHALL) deixar o livro, as folhas e a impressão numa aba própria, com endereço próprio.

#### Scenario: Funcionária abre o Protocolo
- **WHEN** a funcionária abre o Protocolo com títulos em andamento
- **THEN** vê a faixa Hoje, os números do dia e a lista de títulos antes de qualquer opção de impressão do livro

### Requirement: Situação do título com cor e prazo
O sistema DEVE (SHALL) mostrar a situação de cada título sempre com a mesma cor de significado e, quando corre um prazo, a data e a parte do prazo já usada.

#### Scenario: Qualificação vence hoje
- **WHEN** a qualificação de um título prenotado vence hoje
- **THEN** a situação aparece em vermelho como "Vence hoje", com a data e a barra do prazo
