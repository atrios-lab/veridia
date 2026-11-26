## ADDED Requirements

### Requirement: Imagens do Livro 2 no padrão da ONR
O sistema DEVE (SHALL) transformar a matrícula anexada (Word ou PDF) num TIFF preto e branco de 200 × 200 dpi, compressão sem perdas (CCITT Group 4), multipágina. O TIFF DEVE levar a imagem da assinatura de quem assina e ser nomeado e posto na pasta pelo padrão escolhido; o padrão inicial é o principal do manual: `00000000\00000001.TIF`. A assinatura digital DEVE continuar facultativa.

#### Scenario: Matrículas 1 a 5 em lote
- **WHEN** o funcionário anexa as matrículas 1, 2, 3, 4 e 5 e escolhe "Assinar para exportar para a ONR"
- **THEN** o sistema confere cada uma, aponta as divergências e entrega um `.zip` com `00000000\00000001.TIF` até `00000005.TIF`, prontos para copiar na pasta do CSL2

#### Scenario: Divergência apontada
- **WHEN** o número da matrícula no texto não bate com o do acervo
- **THEN** o assistente virtual aponta a divergência e o sistema não gera a imagem até o funcionário confirmar ou corrigir
