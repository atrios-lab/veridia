## Why

Uma CNH assinada pela plataforma saiu sem nada visível. O PDF já vinha assinado pelo órgão emissor e, para
não invalidar essa assinatura, a plataforma não desenhava a faixa nem o QR. Faltavam também quatro coisas:
- ver de novo e reimprimir um documento assinado;
- tirar um documento da lista;
- assinar vários de uma vez e emendar outro logo em seguida;
- no site do cidadão, um caminho claro para validar os documentos da serventia, com a base legal.

## What Changes

- **Assinatura visível em PDF já assinado:** a faixa e o QR entram na primeira página como aparência da nova
  assinatura, com o nome de quem assinou e a data, sem tocar nas páginas. As assinaturas anteriores continuam
  válidas.
- **Páginas giradas ou recortadas:** a faixa respeita o CropBox e o /Rotate.
- **Assinar em lote:** vários PDFs, com o certificado e a senha digitados uma vez. Cada arquivo vai num envio
  próprio. Ao terminar, aparecem os links de cada documento e o botão "Assinar outros documentos". A página
  do documento ganha "Assinar outro documento".
- **Abrir para imprimir:** o PDF assinado abre no navegador, pela lista ou pela página do documento.
- **Excluir da lista:** o documento sai da lista e o arquivo deixa de abrir. O registro continua respondendo
  à verificação, e dá para devolver o documento à lista. Só quem assinou ou o Tabelião/Registrador faz isso.
  Fica na auditoria.
- **Site:**
  - cartão "Validar documento" na página inicial;
  - quadro "Segurança jurídica" em `/verificar`, com o art. 208, II, "b", do Código Nacional de Normas
    (Provimento CNJ 180/2024), a MP 2.200-2/2001 (art. 10, § 1º), a Lei 14.063/2020 (art. 4º, III) e a Lei
    11.977/2009 (art. 38, na redação da Lei 14.382/2022).
- **Manifesto:** traz o código e o endereço que leva ao documento assinado.
- **Banco:** a migração `0042` só acrescenta `removed_at` e `removed_by` (colunas que aceitam vazio). Não
  apaga nada.
