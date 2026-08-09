## ADDED Requirements

### Requirement: Atalhos de teclado do painel

Toda tela autenticada do painel SHALL responder aos atalhos de teclado: Ctrl K (ou Cmd K) abre
a busca global; a sequência G seguida de P, em até 1 segundo, navega para `/admin/pedidos`; G
seguida de A navega para `/admin/agenda`; N navega para `/admin/pedidos/novo`. Os atalhos NÃO
SHALL disparar quando o foco está num campo editável (input, textarea, select ou elemento
`contenteditable`) nem, exceto Esc e Ctrl K, com o overlay de busca aberto. Um atalho de
navegação cuja rota exija permissão que a sessão não tem SHALL ficar inativo — e a rota destino
SHALL continuar checando a permissão no servidor.

#### Scenario: Sequência G A navega para a agenda

- **WHEN** o operador pressiona G e, em menos de 1 segundo, A, fora de um campo editável
- **THEN** o painel navega para `/admin/agenda`

#### Scenario: Tecla N dentro de um campo de texto não navega

- **WHEN** o operador digita a letra N num campo de busca ou formulário
- **THEN** nenhuma navegação acontece e o caractere é inserido normalmente

#### Scenario: Ctrl K tem precedência sobre o navegador

- **WHEN** o operador pressiona Ctrl K com o painel focado
- **THEN** o overlay de busca abre e o comportamento nativo do navegador é suprimido
