## Why

Quem pede a análise de um título para registro ou averbação em Imóveis, Títulos e Documentos
ou Pessoas Jurídicas paga a prenotação na entrada, junto com o requerimento assinado. O site não
tinha esse pedido, e o valor dependia de o balcão lançar à mão, consultando a tabela de
emolumentos. Quando a tabela mudava, nada no site acompanhava.

## What Changes

- **Três atos novos** em "Solicitar": "Prenotação: análise do título para registro ou
  averbação" em Imóveis, Títulos e Documentos e Pessoas Jurídicas, cada um perguntando se é para
  registro ou averbação.
- **Valor tirado da tabela vigente.** A tabela vigente é a primeira "Tabela de emolumentos"
  publicada, na ordem do painel (a mesma que o site mostra em Transparência). O valor é sempre
  o total do item. Trocar a tabela vigente troca o valor dos próximos pedidos.
- **Ler o PDF, com opção manual.** Ao subir uma tabela de emolumentos, o site lê o texto do PDF
  e guarda as prenotações que encontrar, marcadas como "lidas do PDF, confira". Na tela
  "Prenotação" da tabela, o cartório lê de novo, corrige ou digita código, descrição e total de
  cada registro, e salva.
- **Cobrado no pedido.** O pedido grava o valor no protocolo (que passa a mostrar o pagamento
  na consulta) e guarda o código, a descrição e o nome da tabela. O formulário, a tela de
  sucesso e o requerimento dizem que o valor é a prenotação, citam o código e a tabela, e
  avisam que os emolumentos do registro ou da averbação vêm depois da análise.
- **Banco.** Nenhuma migração: os valores ficam em `tenant_content` (chave `fee-tables`),
  por documento da tabela.

## Não-objetivos

- Calcular os emolumentos do registro ou da averbação: continuam lançados pelo balcão depois
  da análise.
- Ler tabelas escaneadas (imagem): nesse caso o cartório digita os valores.
