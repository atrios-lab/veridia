## Why

O Código de Normas da CGJ/TJRN (Provimento 156/2016, art. 2º) manda a serventia se identificar
pela denominação, com a comarca, e proíbe nome fantasia e logomarca; a regra vale para os materiais
de expediente e para as páginas na internet (§ 3º). Os documentos gerados pelo site saíam com a
logomarca e sem a comarca, e nem sempre o cadastro sabia qual é a comarca ou o termo da serventia.

## What Changes

- **Cabeçalho padrão** em todos os PDFs (requerimento, comprovantes, declaração de comparecimento,
  Anexo I, boletim), como nas certidões da serventia: brasão da República, "República Federativa do
  Brasil", "Serviço Notarial e Registral" (ou só a metade que a serventia exerce), a denominação
  oficial e a comarca/termo. Sem logomarca.
- **Opcional, em letra menor** (§ 1º): o nome do(a) titular com o cargo e as atribuições. Desligados
  por padrão, como no modelo de Ielmo Marinho.
- **Rodapé** com endereço, telefone, e-mail e site.
- **Configurações → Identificação nos documentos**: denominação oficial, "Comarca de", "Termo de",
  "Comarca/Termo de" ou "Não mostrar", cidade sede, e as duas caixas opcionais, com prévia do
  cabeçalho.
- **Textos**: o requerimento é dirigido ao oficial do cartório com a comarca; a declaração de
  comparecimento e o Anexo I usam a denominação oficial e a comarca.
- Ielmo Marinho já vem com "Cartório do Ofício Único de Ielmo Marinho/RN" e "Comarca/Termo de
  Macaíba/RN".
- Banco: nada muda (a configuração fica em `tenant_content`, chave `office-identification`).
