## MODIFIED Requirements

### Requirement: Tema do site público por configuração do tenant
O site público DEVE (SHALL) renderizar com a marca do tenant resolvido pelo host, mantendo
estrutura, layout e jornada idênticos entre tenants. A configuração do tenant nomeia um dos
temas oferecidos (paleta mais serifada); cadastrar serventia DEVE (SHALL) ser escolher um tema,
nunca escrever CSS. Nenhuma cor DEVE (SHALL) ser codificada fora do bloco de tema da folha de
estilo: os componentes usam apenas tokens. Todo tema oferecido DEVE (SHALL) manter os pares de
texto da paleta em contraste de 4,5:1 ou mais, mesmo antes de alguma serventia usá-lo.

#### Scenario: Dois hosts, duas marcas, mesma estrutura
- **WHEN** a mesma rota pública é servida para `marinho.localhost` e para o host do tenant `aurora`
- **THEN** cada resposta usa a paleta e a serifada do seu tenant, com o mesmo HTML estrutural

#### Scenario: Fonte serifada por enum
- **WHEN** o tenant configura uma das dez serifadas suportadas (Spectral, Libre Baskerville, Lora, Bitter, Cormorant Garamond, Merriweather, Playfair Display, Crimson Pro, Literata, Source Serif 4)
- **THEN** os títulos do site público renderizam nessa fonte, e o corpo permanece em Public Sans

#### Scenario: Tema novo sem serventia ainda
- **WHEN** um tema é acrescentado à lista e nenhuma serventia o escolheu
- **THEN** a verificação automática mede o contraste dos pares de texto dele e falha se algum
  ficar abaixo de 4,5:1
