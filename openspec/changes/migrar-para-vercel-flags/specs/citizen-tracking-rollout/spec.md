## MODIFIED Requirements

### Requirement: Fallback seguro quando a flag não pode ser lida
Se o Vercel Flags (SDK Key ausente, serviço temporariamente inacessível, ou definição não encontrada) não puder resolver o valor da flag, o sistema SHALL usar o valor padrão da flag (desligada), preservando o comportamento anterior a esta mudança. Uma falha de leitura da flag NÃO SHALL derrubar a renderização da página nem propagar erro ao cidadão.

#### Scenario: Serviço de flags indisponível
- **WHEN** o Vercel Flags está inacessível no momento da renderização
- **THEN** os pontos de entrada de consulta apontam para `/protocolo`, e a página renderiza normalmente

### Requirement: Ambiente local e CI funcionam sem configuração adicional
Em ambientes sem a SDK Key do Vercel Flags configurada (desenvolvimento local sem `vercel env pull`, CI), o sistema SHALL usar o valor padrão da flag sem exigir nenhuma variável de ambiente nova além da já documentada. Testes automatizados SHALL poder forçar um valor específico da flag por override, sem depender de um serviço real configurado.

#### Scenario: Desenvolvimento local sem SDK Key configurada
- **WHEN** o site roda localmente sem a variável `FLAGS` definida
- **THEN** o comportamento é o padrão (flag desligada), sem erro de configuração

#### Scenario: Teste automatizado força a flag ligada
- **WHEN** um teste end-to-end define um override para ligar a flag
- **THEN** os pontos de entrada de consulta apontam para `/acompanhar` apenas naquele teste, sem afetar outras execuções
