## ADDED Requirements

### Requirement: Leitura de documentos da matrícula
O sistema DEVE (SHALL) aceitar a matrícula ou o título em Word, PDF ou foto, ler a abertura e os lançamentos (pelo assistente virtual, ou pelo texto quando ele não estiver disponível) e mostrar a leitura para conferência; só os campos vazios e os lançamentos marcados DEVEM (SHALL) entrar, cada um com o número que tem na ficha.

#### Scenario: Matrícula em Word
- **WHEN** a funcionária anexa a matrícula em Word e confere a leitura
- **THEN** a matrícula é criada com a abertura, os proprietários e os atos R-1, R-2 e AV-3, e o
  cancelamento do AV-3 baixa a hipoteca do R-2

### Requirement: Ficha impressa, assinada e em imagem
O sistema DEVE (SHALL) emitir a ficha da matrícula em PDF para imprimir e assinar à mão, para o assinador digital, ou com a imagem da assinatura de quem assina, e em TIFF preto e branco (1 bit, G4, 300 dpi) para a ONR, avisando que a imagem não substitui a assinatura.

#### Scenario: PDF com a assinatura
- **WHEN** a imagem da assinatura está cadastrada e a funcionária escolhe "PDF com a minha assinatura"
- **THEN** o PDF sai com a imagem sobre a linha, o nome e o cargo de quem assina

### Requirement: Livro 3
O sistema DEVE (SHALL) manter o Livro 3 em tela própria, com natureza (Lei nº 6.015/1973, art. 178), partes e matrícula a que se refere, e NÃO DEVE (SHALL NOT) mandá-lo no Indicador Real nem no arquivo do Indicador Pessoal da ONR.

#### Scenario: Pacto antenupcial
- **WHEN** a funcionária cadastra no Livro 3 uma convenção antenupcial
- **THEN** ela aparece no índice do Livro 3 e as partes no Indicador Pessoal da serventia
