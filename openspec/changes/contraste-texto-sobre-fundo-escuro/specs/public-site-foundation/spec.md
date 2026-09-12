## MODIFIED Requirements

### Requirement: Tema do site público por configuração do tenant
O site público DEVE (SHALL) renderizar com a marca do tenant resolvido pelo host, mantendo
estrutura, layout e jornada idênticos entre tenants. A configuração do tenant nomeia um dos
temas oferecidos (paleta mais serifada); cadastrar serventia DEVE (SHALL) ser escolher um tema,
nunca escrever CSS. Nenhuma cor DEVE (SHALL) ser codificada fora do bloco de tema da folha de
estilo: os componentes usam apenas tokens.

Todo texto sobre o fundo escuro da marca (`bg-brand-primary`, `bg-brand-shade`), inclusive os
tons derivados por mistura, DEVE (SHALL) atingir contraste mínimo de 4,5:1 em cada um dos
temas oferecidos. A varredura de acessibilidade (`check:a11y`) DEVE (SHALL) passar nos cinco
temas.

#### Scenario: Dois hosts, duas marcas, mesma estrutura
- **WHEN** a mesma rota pública é servida para `marinho.localhost` e para o host do tenant `aurora`
- **THEN** cada resposta usa a paleta e a serifada do seu tenant, com o mesmo HTML estrutural

#### Scenario: Fonte serifada por enum
- **WHEN** o tenant configura uma das cinco serifadas suportadas (Spectral, Libre Baskerville, Lora, Bitter, Cormorant Garamond)
- **THEN** os títulos do site público renderizam nessa fonte, e o corpo permanece em Public Sans

#### Scenario: Texto apagado legível em todos os temas
- **WHEN** a varredura de acessibilidade abre o rodapé de qualquer página pública em cada um dos
  cinco temas
- **THEN** a linha de créditos e os demais textos sobre o fundo escuro passam no contraste
  mínimo, sem violação critical ou serious
