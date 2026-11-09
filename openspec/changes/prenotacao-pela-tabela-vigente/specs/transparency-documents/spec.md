## ADDED Requirements

### Requirement: Valores da prenotação por tabela de emolumentos

Cada documento da categoria "Tabela de emolumentos" SHALL ter os valores da prenotação de
Imóveis, Títulos e Documentos e Pessoas Jurídicas (código, descrição e total). Ao subir a
tabela, o site SHALL ler o PDF linha a linha, achar cada prenotação pelo código da tabela do
estado e guardar sozinho apenas o item cujas parcelas somam o total, marcado como lido do PDF. O
painel SHALL permitir ler o PDF de novo, corrigir e digitar os valores à mão, e SHALL marcar na
lista a tabela vigente (a primeira publicada da categoria).

#### Scenario: PDF com texto

- **WHEN** o cartório sobe a tabela do RN, com 2600103 (57,90), 2500140 (57,90) e 2400105 (31,51), cada um com parcelas que somam o total
- **THEN** a lista mostra "Prenotação: 3 de 3 valores (lidos do PDF, confira)" e a tela da tabela abre com os três códigos e totais

#### Scenario: Soma que não bate

- **WHEN** na linha do código 2600103 as parcelas não somam o último valor
- **THEN** o valor não é guardado sozinho, e a tela pede para conferir o total na tabela

#### Scenario: PDF escaneado

- **WHEN** o PDF não tem texto legível
- **THEN** "Ler do PDF" avisa que não encontrou a prenotação e o cartório digita os valores
