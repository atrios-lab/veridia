## ADDED Requirements

### Requirement: Protocolo do Registro de Imóveis
O sistema DEVE (SHALL) lançar cada título no Livro 1 com o próximo número de ordem da sua série e calcular em dias úteis o prazo de qualificação (10 dias, ou 5 nos casos do art. 188, § 1º) e o fim da prenotação (20 dias, ou 40 na Reurb social), e NÃO DEVE (SHALL NOT) tirar um protocolo do Livro 1: apagar só marca, com o motivo.

#### Scenario: Título apresentado numa segunda-feira
- **WHEN** a funcionária prenota um título apresentado em 02/03/2026
- **THEN** o protocolo recebe o próximo número, a qualificação vence em 16/03/2026 e a prenotação em 30/03/2026

### Requirement: Nota devolutiva e registro com selo
O sistema DEVE (SHALL) emitir a nota devolutiva com todas as exigências e a fonte de cada uma, aceitar o reingresso dentro da prenotação com novo prazo de 5 dias úteis, e só concluir o protocolo como registrado quando todos os atos lançados com o seu número tiverem selo.

#### Scenario: Ato sem selo
- **WHEN** a funcionária tenta concluir como registrado um protocolo cujo ato não tem selo
- **THEN** o sistema recusa e diz qual ato está sem selo
