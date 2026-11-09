## ADDED Requirements

### Requirement: Valores da prenotação por tabela de emolumentos

Cada documento da categoria "Tabela de emolumentos" SHALL ter os valores da prenotação de
Imóveis, Títulos e Documentos e Pessoas Jurídicas (código, descrição e total). Ao subir a
tabela, o site SHALL ler o texto do PDF e guardar o que encontrar, marcado como lido do PDF. O
painel SHALL permitir ler o PDF de novo, corrigir e digitar os valores à mão, e SHALL marcar na
lista a tabela vigente (a primeira publicada da categoria).

#### Scenario: PDF com texto

- **WHEN** o cartório sobe uma tabela cujo PDF traz "2600103 Prenotação ... 57,90" na seção de Imóveis
- **THEN** a lista mostra "Prenotação: 1 de 3 valores (lidos do PDF, confira)" e a tela da tabela abre com 2600103 e 57,90

#### Scenario: PDF escaneado

- **WHEN** o PDF não tem texto legível
- **THEN** "Ler do PDF" avisa que não encontrou a prenotação e o cartório digita os valores
