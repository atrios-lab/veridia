## Why

A Resolução CNJ nº 670/2025 reescreveu o art. 6º, § 3º, da Resolução CNJ nº 215/2015: a serventia
tem de manter no site um campo "transparência" com as **receitas públicas** do mês discriminadas por
rubrica (Emolumentos, parcela pública; Fundo de Reaparelhamento da Justiça; Fundo de Compensação;
Outros Fundos Especiais). A **parcela privada** fica fora do site e só é acessível a terceiro
interessado por requerimento fundamentado à Corregedoria (§ 3º-B). A CGJ-RN repassou a exigência às
serventias pelo Ofício Circular nº 29/2026, recebido pelo malote em 24/09/2026.

O boletim mensal de hoje erra nas duas direções. Junta todos os fundos num único campo, "Tributos
pagos (FCRCPN, FRMP, FDJ, FUNAF, ISS)", e publica justamente o que a norma restringe: arrecadação
bruta, despesas de custeio e um saldo final que, na prática, é a remuneração do titular.

Agora é o momento de corrigir: nenhuma serventia publicou boletim até hoje, e o vídeo de treinamento
da Transparência ainda não foi gravado. Trocar o formato agora não deixa histórico para migrar nem
ninguém treinado no formato errado.

## What Changes

- **BREAKING** O boletim deixa de ter arrecadação bruta, tributos pagos, despesas e saldo final. Some
  do formulário, da pré-visualização, do PDF público e do banco.
- O boletim passa a pedir o valor recolhido no mês para cada fundo, com os mesmos nomes das colunas
  da tabela de emolumentos do estado. No RN: FDJ, FRMP, FCRCPN e FUNAF. A operadora copia do
  relatório ou da guia do mês, sem classificar nada.
- A classificação de cada fundo numa rubrica do CNJ fica num mapa por UF no núcleo. No RN: FDJ → II
  Reaparelhamento da Justiça, FCRCPN → III Fundo de Compensação, FRMP e FUNAF → IV Outros Fundos
  Especiais. A rubrica I, Emolumentos (parcela pública), não tem coluna correspondente no RN e não é
  exibida enquanto a CGJ-RN não disser o contrário.
- O ISS entra numa linha própria, fora das rubricas, como tributo municipal com o nome do município
  da serventia. O valor é digitado; a alíquota (`issRate`) não participa.
- "Atos praticados" continua no boletim.
- O PDF e a página pública passam a mostrar o subtotal de cada rubrica com o detalhe por fundo, o
  total recolhido aos fundos e a linha do ISS à parte.
- A seção do boletim em `/transparencia` ganha um aviso fixo: a parcela privada pode ser solicitada
  à Corregedoria-Geral de Justiça por requerimento fundamentado (§ 3º-B).
- O rodapé legal do boletim passa a citar o art. 6º, § 3º, da Res. CNJ 215/2015, com a redação da
  Res. CNJ 670/2025.
- O tenant ganha a localização para exibição (cidade com acento e UF). A UF escolhe o mapa de
  fundos; a cidade dá nome à linha do ISS.

## Não-objetivos

- **Canal de pedido da parcela privada.** O requerimento do § 3º-B vai para a Corregedoria, não para
  a serventia nem para a plataforma. O site só informa o caminho.
- **Importar valores automaticamente** do Justiça Aberta, do selo digital ou do sistema do cartório.
  A operadora continua digitando os números do mês.
- **Confirmar as alíquotas de ISS** (`issRate`) de cada município. É dado a levantar com as
  serventias, usado no cálculo de custas; o boletim não depende dele.
- **Tela para editar rubricas ou fundos.** O mapa é código, como as atribuições.
- **Mapas de outros estados.** Todas as serventias atendidas são do RN; outra UF entra quando houver
  cliente fora do RN.
- **Linha de "despesas públicas" separada.** No RN o dinheiro público sai da serventia como
  recolhimento aos fundos, que é o que o boletim já mostra. Ver pergunta aberta no design.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `transparency-bulletin`: o saldo calculado sai; o boletim passa a receber um valor por fundo, a
  classificá-lo em rubricas do CNJ por UF, a exibir o ISS numa linha própria, a avisar sobre a
  parcela privada e a citar a Res. 670 no rodapé. A pré-visualização e o PDF mudam de conteúdo.

## Impact

- `src/core/transparency/bulletin.ts`: some `BulletinFigures` com os quatro valores e
  `bulletinBalanceCents`; entram valores por fundo, ISS e o agrupamento por rubrica.
- `src/core/transparency/rubrics.ts` (novo): as rubricas do CNJ e o mapa de fundos por UF.
- `src/core/tenant/schema.ts` e os 13 arquivos em `src/core/tenant/tenants/`: campo de localização
  (cidade e UF).
- `src/db/schema.ts` e migração: `transparency_bulletins` ganha os valores por fundo e o ISS; as
  colunas `gross_revenue_cents`, `taxes_paid_cents` e `expenses_cents` saem em dois deploys (expand e
  contract). Produção é migrada à mão antes do merge.
- `src/lib/transparency.ts`: `BulletinInput` e `upsertBulletin`.
- `src/app/admin/(dashboard)/transparencia/`: `actions.ts`, `bulletin-form.tsx`,
  `bulletin-preview.tsx`, `bulletin-list.tsx`.
- `src/lib/pdf.ts`: corpo do PDF do boletim e rodapé legal.
- `src/app/(public)/transparencia/page.tsx`: aviso da parcela privada na seção do boletim.
