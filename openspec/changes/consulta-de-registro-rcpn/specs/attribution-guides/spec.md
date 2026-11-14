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

### Requirement: Arquivos em todas as atribuições
Cada atribuição DEVE (SHALL) ter um campo para enviar arquivos de qualquer formato (decisão de
14/11/2026), com o tipo reconhecido pelo conteúdo (PDF, XML com o elemento principal, JSON, texto,
planilha, imagem, pacote, banco Access), descrição opcional, recusa do mesmo arquivo repetido na
mesma atribuição e envio direto ao armazenamento para arquivos grandes. Excluir DEVE (SHALL) pedir
justificativa e só marcar o arquivo, que continua guardado e na auditoria. A permissão
"Atribuições: enviar e excluir arquivos" DEVE (SHALL) aparecer em Perfis e permissões.

#### Scenario: Remessa de central no protesto
- **WHEN** a pessoa envia um XML de remessa na área do Protesto
- **THEN** o arquivo aparece na lista como XML, com o elemento principal, e um segundo envio do mesmo arquivo é recusado com a data do primeiro

### Requirement: Roteiros dos atos
Cada atribuição com requisitos de ato fixados em lei DEVE (SHALL) mostrar roteiros para marcar na
hora do ato, cada item tirado do artigo citado (escritura: Código Civil, art. 215, § 1º; intimação
e instrumento de protesto: Lei nº 9.492/1997, arts. 14, § 2º, e 22; registro de pessoa jurídica:
Lei nº 6.015/1973, art. 120; registro na matrícula: art. 176, § 1º, III). Onde a regra mudou ou
depende de norma do CNJ ou do estado, o roteiro DEVE (SHALL) dizer o que conferir.

#### Scenario: Escrevente lavrando escritura
- **WHEN** a pessoa abre Atribuições › Notas
- **THEN** vê o roteiro da escritura pública com os sete requisitos do art. 215, § 1º, para marcar
