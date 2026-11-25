## Why

A serventia quer que o Registro de Imóveis seja um sistema completo dentro do Veridia, no lugar
do sistema que usa hoje: protocolo, matrículas, atos, livros, assinatura, selos e os arquivos que
a ONR pede (decisão de 25/11/2026). O primeiro passo é o acervo: a migração das matrículas para
fichas (CNN, arts. 336 a 339) está em curso numa planilha, o lote de CNM do PGV-CNM está parado
esperando a consolidação, e o Indicador Real precisa ir à ONR toda semana (Prov. CNJ nº 143/2023,
art. 15, pelo CNN, art. 342).

## What Changes

- Atribuições › Registro de Imóveis abre em outra aba um sistema próprio: barra, menu lateral e
  a Mesa do RI com o que o acervo pede hoje.
- Matrículas (Livro 2, Livro 3 e transcrições) com os dados do Indicador Real do ONR, CNM e a
  situação no PGV-CNM; atos R e AV com a numeração do art. 232 da Lei nº 6.015/1973, continuando
  a ficha; situação atual (proprietários e ônus em vigor) calculada dos atos.
- Pessoas: cadastro único que forma o Indicador Pessoal (Livro 5).
- Importação da planilha do índice com conferência antes de salvar.
- Pendências da migração com o passo a passo e a fonte: número repetido (art. 338), possível
  duplicidade (art. 337), salto de numeração (art. 339), CNM ausente ou que não confere
  (art. 330), dados que faltam ao Indicador Real, matrícula sem proprietário.
- Arquivos para a ONR, gerados e guardados, para a serventia importar com o certificado do
  oficial: lote de CNM (XML do PGV), Indicador Real (JSON v1.5) e Indicador Pessoal (XML do
  Banco Light, ISO-8859-1).
- Quatro permissões novas: consultar, alterar, importar e gerar os arquivos da ONR.
- Tudo o que se cria tem alterar e apagar; apagar só marca, o anterior fica no histórico e na
  auditoria.

## Capabilities

### New Capabilities
- `registro-de-imoveis`: o sistema de Registro de Imóveis da serventia.

## Impact

- Banco: seis tabelas novas (`ri_settings`, `ri_properties`, `ri_people`, `ri_acts`,
  `ri_act_parties`, `ri_exports`). Só cria; nada é apagado nem alterado.
- Código: `src/core/ri`, `src/lib/ri.ts`, `src/lib/ri-sheet.ts`, `src/app/admin/ri`, menu e guia de
  Atribuições, permissões e rótulos da auditoria.
- Próximas fases: protocolo e prenotação, mapa e georreferenciamento (SIG-RI), livros e assinatura
  com A3, imagens do Livro 2 e envio direto pelo WS Ofício.
