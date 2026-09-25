## Why

A Resolução CNJ nº 670/2025 reescreveu o art. 6º, § 3º, da Resolução CNJ nº 215/2015: a serventia
tem de manter no site um campo "transparência" com as **receitas públicas** do mês discriminadas por
rubrica (Emolumentos, parcela pública; Fundo de Reaparelhamento da Justiça; Fundo de Compensação;
Outros Fundos Especiais). A CGJ-RN repassou a exigência às serventias pelo Ofício Circular
nº 29/2026, recebido pelo malote em 24/09/2026.

O boletim mensal de hoje copia o quadro que as serventias já publicam: atos, arrecadação, "tributos
pagos (FCRCPN – FRMP – FDJ – FUNAF – ISS)", despesas e saldo final. O problema está nos tributos,
que entram num valor único, e a norma pede exatamente a separação desses fundos.

Arrecadação bruta, despesas e saldo são parcela privada. O § 3º-B garante que terceiro interessado
possa pedi-la à Corregedoria, mas não proíbe a serventia de publicá-la por conta própria. Como é
dado financeiro do titular, publicar ou não é uma escolha dele.

Agora é o momento de corrigir: nenhuma serventia publicou boletim até hoje, e o vídeo de treinamento
da Transparência ainda não foi gravado.

## What Changes

- O campo único "Tributos pagos" é substituído por um valor recolhido no mês para cada fundo, com
  os mesmos nomes das colunas da tabela de emolumentos do estado (no RN: FDJ, FRMP, FCRCPN e FUNAF),
  e um valor de ISS. O total de tributos passa a ser calculado pela soma, nunca digitado.
- A classificação de cada fundo numa rubrica do CNJ fica num mapa por UF no núcleo. No RN: FDJ → II
  Reaparelhamento da Justiça, FCRCPN → III Fundo de Compensação, FRMP e FUNAF → IV Outros Fundos
  Especiais. A rubrica I, Emolumentos (parcela pública), não tem coluna correspondente no RN e não é
  exibida enquanto a CGJ-RN não disser o contrário.
- O ISS entra numa linha própria, fora das rubricas, como tributo municipal com o nome do município
  da serventia. O valor é digitado; a alíquota (`issRate`) não participa.
- Arrecadação, despesas e saldo final passam a depender de uma **opção da serventia**, "Publicar
  também arrecadação, despesas e saldo", ligada por padrão. Ligada, o boletim fica como hoje, com os
  tributos abertos por fundo. Desligada, esses três números somem do formulário, da
  pré-visualização e do PDF de todos os meses.
- O saldo continua calculado no núcleo: arrecadação − fundos − ISS − despesas. O rótulo passa a ser
  o que as serventias já usam: "Saldo final (emolumentos e outras receitas)".
- "Atos praticados" continua no boletim.
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
- **Opção por mês.** A opção de publicar a parcela privada vale para a serventia inteira, não para
  cada boletim.
- **Linha de "despesas públicas" separada.** No RN o dinheiro público sai da serventia como
  recolhimento aos fundos, que é o que o boletim já mostra. Ver pergunta aberta no design.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `transparency-bulletin`: os tributos passam a ser um valor por fundo, classificado em rubricas do
  CNJ por UF, com o ISS numa linha própria; arrecadação, despesas e saldo passam a depender de uma
  opção da serventia; o boletim ganha o aviso da parcela privada e a citação da Res. 670 no rodapé.
  A pré-visualização e o PDF mudam de conteúdo.

## Impact

- `src/core/transparency/bulletin.ts`: `BulletinFigures` troca `taxesPaidCents` por valores por fundo
  e ISS; arrecadação e despesas ficam opcionais; `bulletinBalanceCents` passa a somar fundos e ISS.
- `src/core/transparency/rubrics.ts` (novo): as rubricas do CNJ e o mapa de fundos por UF.
- `src/core/tenant/schema.ts`, `src/core/tenant/overrides.ts` e os 13 arquivos em
  `src/core/tenant/tenants/`: campo de localização (cidade e UF) e a opção
  `publishBulletinPrivateFigures`, com default `true` e override pelo painel.
- `src/db/schema.ts` e migração: `transparency_bulletins` ganha os valores por fundo e o ISS;
  arrecadação e despesas ficam nuláveis; `taxes_paid_cents` sai em dois deploys (expand e
  contract). Produção é migrada à mão antes do merge.
- `src/lib/transparency.ts`: `BulletinInput` e `upsertBulletin`.
- `src/app/admin/(dashboard)/transparencia/`: `actions.ts`, `bulletin-form.tsx`,
  `bulletin-preview.tsx`, `bulletin-list.tsx` e a opção na aba Boletim mensal.
- `src/lib/pdf.ts`: corpo do PDF do boletim e rodapé legal.
- `src/app/(public)/transparencia/page.tsx`: aviso da parcela privada na seção do boletim.
