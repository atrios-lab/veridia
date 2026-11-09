## Why

Quem pede a análise de um título para anotação, averbação, registro, retificação ou ratificação em Imóveis, Títulos e Documentos
ou Pessoas Jurídicas paga a prenotação na entrada, junto com o requerimento assinado. O site não
tinha esse pedido, e o valor dependia de o balcão lançar à mão, consultando a tabela de
emolumentos. Quando a tabela mudava, nada no site acompanhava.

## What Changes

- **Três atos novos** em "Solicitar": "Prenotação (análise)" em Imóveis, Títulos e Documentos e
  Pessoas Jurídicas, com a lista das cinco finalidades para o cidadão escolher: anotação,
  averbação, registro, retificação ou ratificação.
- **Valor tirado da tabela vigente.** A tabela vigente é a primeira "Tabela de emolumentos"
  publicada, na ordem do painel (a mesma que o site mostra em Transparência). O valor é sempre
  o total do item. Trocar a tabela vigente troca o valor dos próximos pedidos.
- **Ler o PDF com cuidado, com opção manual.** O PDF é lido como tabela: as linhas são
  remontadas pela posição do texto na página (célula por célula, inclusive tabela deitada), e
  cada prenotação é achada pelo código que a tabela do estado usa (RN: Imóveis 2600103,
  Títulos e Documentos 2500140, Pessoas Jurídicas 2400105). O total é o último valor da linha
  e só é aceito sozinho quando as parcelas somam esse total. O que não passa nessa conferência
  (código diferente, soma que não bate) fica para o cartório digitar ou confirmar na tela
  "Prenotação" da tabela. Uma tabela vigente que ninguém leu (publicada antes desta mudança) é
  lida uma vez, no primeiro pedido.
- **Cobrado no pedido.** O pedido grava o valor no protocolo (que passa a mostrar o pagamento
  na consulta) e guarda o código, a descrição e o nome da tabela. O formulário, a tela de
  sucesso e o requerimento dizem que o valor é a prenotação, citam o código e a tabela, e
  avisam que os emolumentos do ato (anotação, averbação, registro, retificação ou ratificação) vêm depois da análise.
- **Banco.** Nenhuma migração: os valores ficam em `tenant_content` (chave `fee-tables`),
  por documento da tabela.

## Não-objetivos

- Calcular os emolumentos do ato (anotação, averbação, registro, retificação ou ratificação): continuam lançados pelo balcão depois
  da análise.
- Ler tabelas escaneadas (imagem): nesse caso o cartório digita os valores.
