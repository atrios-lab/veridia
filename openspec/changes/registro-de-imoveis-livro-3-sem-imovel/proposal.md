## Why

A serventia lembrou (25/11/2026) que o Livro 3 não tem, necessariamente, imóvel. Pediu que o
sistema siga a lei e a cartilha do IRIB (*Cédulas de crédito no registro de imóveis*). A fase 1b
tratou o registro auxiliar como uma matrícula: com localização, área, proprietários e situação.

## What Changes

- Os registros do Livro 3 seguem a Lei nº 6.015/1973, arts. 177 e 178 (texto vigente conferido no
  Planalto) e não têm imóvel. Um registro tem:
  - natureza e título (número e emissão);
  - partes: emitente, credor, avalista, interveniente, fiel depositário, cônjuges, emissora,
    condomínio;
  - valor, vencimento, praça e encargos;
  - garantias e local dos bens;
  - no pacto antenupcial: regime de bens, casamento, domicílio e escritura;
  - protocolo;
  - matrículas relacionadas, opcionais, para a remissão recíproca.
- "Como fazer" por natureza, com a regra vigente e a fonte:
  - **Cédula de crédito rural:** a Lei nº 13.986/2020 (art. 61) revogou o art. 167, I, 13, da Lei
    nº 6.015/1973 e os arts. 30 a 40 do Decreto-Lei nº 167/1967. A cédula não se inscreve mais.
    Registra-se o penhor rural no Livro 3 (CC, art. 1.438; art. 178, VI) e a hipoteca cedular na
    matrícula (DL 167, arts. 23 e 24).
  - **Pacto antenupcial:** CC, arts. 1.653 e 1.657; LRP, arts. 167, II, 1, 178, V, e 244.
  - **Convenção de condomínio:** CC, art. 1.333; LRP, arts. 167, I, 17, e 178, III.
  - **Penhor industrial:** CC, art. 1.448; LRP, art. 178, IV.
  - **Cédula de crédito industrial:** LRP, arts. 167, I, 14, e 178, II.
  - **Debêntures:** LRP, art. 178, I.
  - **Bem de família:** LRP, art. 263.
  - **Título no inteiro teor:** LRP, art. 178, VII.
- As partes do Livro 3 entram no Indicador Pessoal (art. 180: pessoas dos "demais livros").
- Ficha, tela, lista e planilha de importar e exportar com os campos do Livro 3.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- Banco: migração 0086, que só acrescenta a coluna `aux` (jsonb) em `ri_properties`.
- Código:
  - novo `src/core/ri/auxiliary.ts`;
  - ajustes em `property.ts`, `ficha.ts`, `transfer.ts` e `ri.ts`;
  - telas do Livro 3, formulário e Indicador Pessoal.
