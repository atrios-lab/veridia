## Why

A serventia pediu para fazer os livros do Registro de Imóveis no próprio sistema e assiná-los, tanto em papel quanto digitalmente, como a ONR quer. Esta é a quarta fase do módulo.

## What Changes

- **Livros e assinatura**, uma tela nova no menu do RI:
  - **Abrir um livro:** escolhe o Livro 1, 2, 3, 4 ou 5 e informa o número com letra (2, 2-A, 2-B: Lei nº 6.015/1973, art. 6º), a forma de escrituração (fichas, folhas ou meio eletrônico), as folhas e a abrangência.
  - **Termo de abertura e termo de encerramento:** saem em PDF. Dá para assinar digitalmente (ICP-Brasil, A1 ou A3) ou imprimir para assinar à mão (art. 4º). Assina quem está em "Quem assina" (art. 210).
  - **Livro inteiro num PDF:** traz os termos e as fichas (Livros 2 e 3), o Protocolo de cada dia (Livro 1) ou o indicador tirado do acervo (Livros 4 e 5). Dá para escolher o intervalo.
  - **Assinatura em lote:** assina as fichas do livro de 20 em 20, digitando a senha do certificado uma vez por lote.
  - **Protocolo do dia:** o encerramento diário do Livro 1 (art. 184), com as colunas do art. 175. Os títulos só para exame e cálculo ficam de fora (art. 12, parágrafo único).
  - **Alterar:** guarda os valores anteriores no histórico.
  - **Encerrar:** registra a data, a última folha e o último número, e pode ser desfeito com justificativa.
  - **Apagar:** só oculta o livro, e dá para restaurar.
  - **Como fazer:** passo a passo com as fontes conferidas no texto oficial:
    - Lei nº 6.015/1973, arts. 1º, § 3º; 3º, § 2º; 4º; 6º; 7º-A; 12; 173; 181; 184; 210;
    - Código Nacional de Normas, art. 336.
    - Também lembra de conferir o modelo do termo no Código de Normas do Estado, porque o Código Nacional não traz modelo para os livros do RI.
- **Assinador:** passa a receber até 20 PDFs já carregados de uma vez.
- **Permissão própria:** "ri.books", que vem de "ri.edit".

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- **Banco:** a migração 0089 só cria a tabela `ri_books`.
- **Pendente:** a assinatura das fichas no padrão técnico do SREI depende das instruções técnicas da ONR e do Provimento CNJ nº 89/2019.
