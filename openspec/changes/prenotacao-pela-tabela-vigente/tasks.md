## 1. Regras

- [x] 1.1 `core/fees/prenotation.ts`: itens por registro, leitura do texto da tabela, valor em reais, aviso; testes
- [x] 1.2 Catálogo: `ri-prenotacao`, `rtd-prenotacao`, `rcpj-prenotacao` com `chargesPrenotation`; testes
- [x] 1.3 Requerimento com a linha "Prenotação" (valor, código, tabela); testes

## 2. Dados

- [x] 2.1 `lib/fee-tables.ts`: valores por tabela em `tenant_content`, tabela vigente, leitura do PDF (unpdf); testes
- [x] 2.2 Salvar uma tabela nunca apaga as outras (leitura estrita antes de gravar)

## 3. Site

- [x] 3.1 Formulário com o cartão da prenotação (valor, código, tabela) ou o aviso de que o balcão informa
- [x] 3.2 Pedido grava `amountCents` e `details.prenotation`; tela de sucesso repete o aviso

## 4. Painel

- [x] 4.1 Leitura automática ao subir uma tabela de emolumentos
- [x] 4.2 Lista de documentos marca a tabela vigente e o estado dos valores
- [x] 4.3 Tela "Prenotação" da tabela: ler do PDF, corrigir, digitar e salvar
