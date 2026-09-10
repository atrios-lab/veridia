## ADDED Requirements

### Requirement: Justificativa obrigatória ao cancelar ou indeferir

Mudar o andamento de um pedido para "Cancelado" ou "Indeferido" SHALL exigir uma justificativa em
texto livre, não vazia depois de removidos os espaços das pontas, com o mesmo teto de tamanho já
usado em exigência e conversa. A tela SHALL pedir o motivo antes de confirmar a mudança — pela
pastilha de sugestão ou pelo "Aplicar" da correção manual — em vez de aplicar a mudança de
imediato como os demais dezesseis andamentos. O servidor SHALL recusar a mudança para esses dois
andamentos sem motivo, mesmo que a requisição não passe pela tela (ex.: script). A justificativa
SHALL ficar gravada no pedido e SHALL aparecer na entrada de histórico daquela mudança de
andamento. Mudar para qualquer um dos outros dezesseis andamentos NÃO SHALL exigir justificativa.

#### Scenario: Pastilha de Cancelado pede motivo antes de confirmar
- **WHEN** o operador clica na pastilha "Cancelado"
- **THEN** a tela abre um campo de motivo com um botão de confirmação, em vez de aplicar a mudança
  no clique

#### Scenario: Correção manual para Indeferido também pede motivo
- **WHEN** o operador escolhe "Indeferido" no select de correção manual e clica "Aplicar"
- **THEN** a tela pede o motivo antes de confirmar, do mesmo jeito que a pastilha de sugestão

#### Scenario: Confirmação sem motivo é recusada
- **WHEN** o operador tenta confirmar o cancelamento com o campo de motivo vazio ou só com espaços
- **THEN** o servidor recusa a mudança e o andamento do pedido não muda

#### Scenario: Motivo aparece no histórico
- **WHEN** o operador cancela um pedido com o motivo "Documentação incompatível com o CPF
  informado"
- **THEN** a entrada de histórico daquela mudança de andamento mostra o motivo, junto de quem
  mudou e quando

#### Scenario: Outros andamentos continuam sem exigir motivo
- **WHEN** o operador muda o andamento para "Em análise" ou qualquer um dos outros quinze
  andamentos que não são Cancelado nem Indeferido
- **THEN** a mudança é aplicada no clique, sem pedir motivo

### Requirement: Indeferimento entra nos avisos por e-mail

"Indeferido" SHALL entrar na lista de andamentos que disparam aviso por e-mail quando o contato do
pedido for um e-mail, junto de "Concluído" e "Cancelado". Assim como os demais avisos dessa lista,
o e-mail de indeferimento NÃO SHALL carregar o motivo: apenas o protocolo e a instrução de
consultar com a chave, onde o motivo completo está disponível.

#### Scenario: Indeferimento avisa por e-mail
- **WHEN** o operador muda o andamento para "Indeferido" num pedido cujo contato é e-mail
- **THEN** chega um aviso de que o pedido foi indeferido, sem o motivo no corpo

#### Scenario: Indeferimento sem e-mail de contato não tenta enviar
- **WHEN** o operador indefere um pedido cujo contato é telefone
- **THEN** nenhum e-mail é tentado e a mudança de andamento é aplicada normalmente
