## Context

Os modelos do sistema atual (mais de cem `.rtf`, analisados só pela estrutura em 14/11/2026) têm um
arquivo por variação e repetem os dados em cada um. O edital deles publica profissão, idade, data
de nascimento e endereço, além do que o CNN, art. 122, permite. Os textos são fixos em "ELE/ELA".

## Decisions

- **Campos, não modelos.** O processo é um mapa `chave → valor` (`n1.nome`, `t2.documento`,
  `regime`...) descrito por seções em `core/rcpn/habilitacao.ts`, como a ficha do registro. A tela,
  a alteração com antes e depois e os documentos leem o mesmo catálogo.
- **Textos próprios.** Os documentos (`core/rcpn/habilitacao-docs.ts`) foram escritos a partir do
  CC, da LRP e do CNN, sem copiar os modelos recebidos. Saem pelo mesmo desenhista dos outros
  documentos do painel (`renderDocument`), que ganhou as assinaturas das partes, em duas colunas,
  com o quadro da impressão digital.
- **Prazos corridos.** O Registro Civil funciona todos os dias (LRP, art. 8º, parágrafo único);
  o art. 9º, § 1º, que conta dias úteis, é dos outros registros. A eficácia é do Código Civil.
- **Edital no site pelo módulo de publicações**, tipo proclamas, com a saída de 15 dias que o
  catálogo de editais já calcula. O processo guarda o id da publicação para não publicar duas vezes.
- **Certificado religioso:** prazo de registro de 90 dias do CC, art. 1.516, § 1º, lei posterior
  ao art. 73 da LRP (30 dias).

## Risks / Trade-offs

- O processo não cria, ainda, o termo do Livro B nem as comunicações dos arts. 106 e 107 da LRP:
  ficam para a etapa seguinte, sobre os mesmos dados.
