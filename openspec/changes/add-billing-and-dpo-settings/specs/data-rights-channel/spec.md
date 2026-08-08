## MODIFIED Requirements

### Requirement: Encarregado de dados publicado sem roubar a dobra

O nome e o contato institucional do Encarregado (DPO) da serventia SHALL estar publicados na
página. O valor exibido SHALL ser o que a serventia gravou na aba Encarregado do painel quando
houver, e o do arquivo de configuração da serventia quando não houver. No celular SHALL ser uma
linha compacta acima do formulário; no desktop, cartão na coluna lateral com o contato e a
referência ao art. 41, §3º da LGPD.

#### Scenario: Serventia distinta, DPO distinto

- **WHEN** a página é servida para outra serventia
- **THEN** o nome e o e-mail exibidos são os do Encarregado daquela serventia, sem alteração de
  código

#### Scenario: O que a serventia gravou é o que a página publica

- **WHEN** a serventia grava um Encarregado novo no painel e um visitante abre a página
- **THEN** o cartão de contato exibe o nome e o e-mail recém-gravados

#### Scenario: Sem gravação no painel, vale a configuração

- **WHEN** a serventia nunca gravou nada na aba Encarregado
- **THEN** a página exibe exatamente o Encarregado do arquivo de configuração dela
