## ADDED Requirements

### Requirement: Busca por protocolo, CPF ou nome nos canais permitidos

O painel SHALL oferecer uma busca global que interpreta o termo digitado: um protocolo
reconhecível (REQ/AGD/SOL/OUV.AAAA.NNNNNN, tolerando minúsculas e espaços) busca por igualdade
de protocolo; um CPF (11 dígitos, com ou sem máscara) busca por igualdade de CPF ignorando a
máscara; qualquer outro termo busca por nome do interessado. Os resultados SHALL vir apenas dos
canais que a sessão tem permissão para operar, com essa restrição aplicada no servidor, e SHALL
mostrar protocolo, canal, interessado e situação, limitados aos mais recentes.

#### Scenario: Protocolo digitado com máscara imperfeita encontra o item

- **WHEN** o operador digita "sol 2026 000031"
- **THEN** o requerimento SOL.2026.000031 aparece como resultado

#### Scenario: CPF com máscara encontra os pedidos do titular

- **WHEN** o operador digita "123.456.789-09" e existe um pedido cujo CPF é "12345678909"
- **THEN** esse pedido aparece nos resultados

#### Scenario: Busca por nome parcial

- **WHEN** o operador digita "maria"
- **THEN** aparecem os itens cujo interessado contém "maria", sem diferenciar maiúsculas

#### Scenario: Sessão sem permissão não recebe resultados do canal

- **WHEN** uma sessão sem a permissão `channels.manage` busca um protocolo SOL existente
- **THEN** o servidor não retorna o item e a busca mostra o estado de nenhum resultado

#### Scenario: Nenhum resultado tem estado explícito

- **WHEN** a busca não encontra nada para o termo
- **THEN** o overlay informa que nada foi encontrado, em português, em vez de ficar em branco

### Requirement: Overlay de busca acessível de qualquer tela do painel

A busca global SHALL abrir como overlay em qualquer tela autenticada do painel — via atalho
Ctrl K (ou Cmd K) e via gatilho no cabeçalho da Visão geral — com foco imediato no campo de
texto. O overlay SHALL ser navegável por teclado (setas para percorrer, Enter para abrir o
resultado, Esc para fechar) e SHALL levar cada resultado ao detalhe do item na fila
correspondente ao seu canal. A busca NÃO SHALL disparar com menos de 2 caracteres.

#### Scenario: Ctrl K abre a busca fora da Visão geral

- **WHEN** o operador pressiona Ctrl K em `/admin/agenda`
- **THEN** o overlay de busca abre com o foco no campo de texto

#### Scenario: Enter abre o detalhe do resultado

- **WHEN** o operador seleciona o resultado AGD.2026.000067 e pressiona Enter
- **THEN** é levado a `/admin/agenda/AGD.2026.000067`

#### Scenario: Esc fecha e devolve a tela intacta

- **WHEN** o operador pressiona Esc com o overlay aberto
- **THEN** o overlay fecha e a tela por trás permanece como estava
