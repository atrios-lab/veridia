# transparency-notices

Avisos institucionais fixos na página pública de transparência: declaração de prevenção à
lavagem de dinheiro (Provimento CNJ n. 149/2023) e cautelas em atos com pessoas idosas
(Provimento CGJ-RN n. 053/2010).

## ADDED Requirements

### Requirement: Seção de avisos institucionais

A página pública de transparência SHALL exibir uma seção "Avisos institucionais" antes da
seção de documentos, contendo dois avisos em texto na própria página: prevenção à lavagem de
dinheiro e cautelas em atos notariais com pessoas idosas. Cada aviso SHALL interpolar o nome
da serventia (`tenant.name`) e o restante do texto SHALL ser idêntico para todos os tenants.

#### Scenario: Cidadão abre a página de transparência

- **WHEN** o cidadão acessa `/transparencia` em um tenant com a seção de transparência ativa
- **THEN** vê a seção "Avisos institucionais" com os avisos de lavagem de dinheiro e de
  pessoas idosas, antes da lista de documentos, com o nome da serventia no texto

#### Scenario: Avisos aparecem mesmo sem documentos publicados

- **WHEN** o tenant não tem nenhum documento nem boletim publicado
- **THEN** os avisos institucionais são exibidos normalmente, junto dos estados vazios das
  demais seções

### Requirement: Conteúdo do aviso de lavagem de dinheiro

O aviso de prevenção à lavagem de dinheiro SHALL declarar o compromisso da serventia com a
identificação e comunicação de operações com indícios de lavagem de dinheiro, referenciar o
Código Nacional de Normas (Provimento CNJ n. 149/2023) com link para o texto oficial no site
do CNJ abrindo em nova aba, e mencionar a identificação de beneficiários finais e o
monitoramento de transações de alto valor. O texto SHALL ser genérico: não cita operações,
valores, partes ou comunicações específicas (sigilo do art. 154 do CNN).

#### Scenario: Link para o provimento oficial

- **WHEN** o cidadão clica na referência ao Provimento n. 149/2023
- **THEN** o texto oficial abre em nova aba, apontando para o domínio oficial do CNJ

### Requirement: Conteúdo do aviso de pessoas idosas

O aviso de atos com pessoas idosas SHALL resumir as cautelas do Provimento n. 053/2010 da
CGJ-RN para atos notariais envolvendo pessoas com 60 anos ou mais: procurações com validade
de um ano e objeto específico, vedação de cláusula de irrevogabilidade fora dos casos em que
ela é da natureza do ato, facilidade de revogação e prestação de informações claras sobre as
consequências do ato, nos termos do Estatuto do Idoso (Lei n. 10.741/2003).

#### Scenario: Aviso presente e legível

- **WHEN** o cidadão lê a seção de avisos institucionais
- **THEN** encontra o aviso de pessoas idosas com as cautelas resumidas e a referência ao
  Provimento n. 053/2010 da CGJ-RN e à Lei n. 10.741/2003
