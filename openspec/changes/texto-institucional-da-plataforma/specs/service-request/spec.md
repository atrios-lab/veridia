## ADDED Requirements

### Requirement: O wizard de pedido apresenta a plataforma
A tela de pedido (`/solicitar`) DEVE (SHALL) trazer, sob o título, uma linha discreta dizendo
que o pedido é recebido pela Plataforma Eletrônica Oficial da Serventia (Provimento CNJ
n. 180/2024), com link para `/plataforma`. NÃO DEVE (SHALL NOT) ser modal nem pop-up, e NÃO
DEVE (SHALL NOT) bloquear nem atrasar o preenchimento.

#### Scenario: A linha está no topo do wizard
- **WHEN** o cidadão abre `/solicitar`
- **THEN** vê, abaixo do título, a linha da plataforma com o link "Saiba mais" para
  `/plataforma`, e o formulário segue disponível sem nenhum aviso a fechar
