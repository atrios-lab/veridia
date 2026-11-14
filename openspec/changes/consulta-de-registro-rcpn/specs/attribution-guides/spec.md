## ADDED Requirements

### Requirement: Guia de cada atribuição
O grupo "Atribuições" da barra lateral DEVE (SHALL) ter uma entrada para cada atribuição da
serventia (Registro Civil, Registro de Imóveis, Títulos e Documentos, Pessoas Jurídicas, Protesto,
Distribuição, Notas) e para o Caixa (decisão de 14/11/2026). Cada guia DEVE (SHALL) mostrar o que a
atribuição faz, as leis, os atos, os livros e índices exigidos pela lei federal, os prazos e
deveres, as palavras explicadas e os atalhos para o que o painel já faz por ela. Toda linha de
livro, índice ou prazo DEVE (SHALL) citar o artigo. O que a lei federal deixa à norma do estado
DEVE (SHALL) aparecer como "Conferir no Código de Normas do RN", sem texto inventado.

#### Scenario: Escrevente abre o guia do Registro de Imóveis
- **WHEN** a pessoa abre Atribuições › Registro de Imóveis
- **THEN** vê os Livros 1 a 3, os indicadores real e pessoal (Livros 4 e 5) com o artigo de cada um, os prazos do protocolo e os atalhos para Pedidos e Guias de transmissão

### Requirement: Explicações com "!" nos guias
Cada parte do guia (lei, atos, livros, índices, prazos e o quadro do Código de Normas) DEVE (SHALL)
ter um "!" que explica o que ela é e como ler. A permissão "Atribuições: consultar os guias"
DEVE (SHALL) aparecer em Perfis e permissões.

#### Scenario: O que é indicador real
- **WHEN** a pessoa abre o "!" da parte Índices
- **THEN** lê que o indicador real é o índice pelos imóveis e o pessoal, pelas pessoas

### Requirement: Atribuições minimizado como Utilitários
O grupo "Atribuições" da barra lateral DEVE (SHALL) ser desenhado como um tópico recolhível, igual
ao de "Utilitários" (decisão de 14/11/2026), e DEVE (SHALL) abrir sozinho quando a pessoa está numa
das suas telas. O Registro Civil DEVE (SHALL) mostrar as suas telas como subitens (pesquisa,
certidões, importar arquivos e o guia), cada uma só para quem tem a permissão.

#### Scenario: Grupo minimizado
- **WHEN** a pessoa está na Visão geral
- **THEN** a barra mostra "Atribuições" fechado e, ao clicar, o tópico abre com as atribuições
