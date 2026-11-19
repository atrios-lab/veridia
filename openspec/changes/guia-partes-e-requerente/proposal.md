## Why

Na serventia, o pedido de guia de imposto feito pelo site tinha cinco problemas:

- Aparecia em Pedidos › "Em análise", mas a lista abria vazia.
- Ao anexar, o site dizia que o documento era grande demais.
- Os documentos não eram separados por parte, então não se sabia quem vendia e quem comprava.
- Ao marcar "Casado(a)", não abria o campo do cônjuge nem o do regime de bens.

Na guia pronta, faltava dizer quem pede e quem é vendedor ou comprador. Os nomes também não se destacavam no texto.

No Assinador, os documentos já assinados ficavam recolhidos, e o funcionário não os achava para baixar de novo.

## What Changes

- A contagem das etapas de Pedidos deixa de contar os pedidos de guia, que ficam só em Utilitários › Guias. Assim o número bate com a lista.
- No site, o pedido de guia fica num formulário só, nesta ordem:
  1. quem está pedindo (comprador, vendedor ou outra pessoa por procuração);
  2. os documentos de cada parte (vendedor, comprador, imóvel e procuração);
  3. os dados das partes;
  4. os dados do imóvel e o valor.
- Cada documento é enviado direto ao armazenamento de arquivos, sem passar pelo limite do pedido. A leitura automática lê um arquivo por vez, até 4 MB.
- Ao marcar "Casado(a)", abrem o nome e o CPF do cônjuge e o regime de bens, e os três são obrigatórios.
- Se quem pede é outra pessoa, ela anexa a procuração ou escreve os dados do mandato (cartório, livro, folha e data).
- A guia ganha a seção "Das partes", com os nomes em negrito. O requerente aparece como "Requerente/Adquirente (comprador)" quando é o próprio comprador, e como "Requerente (procurador)" com o mandato quando é um terceiro. O texto do requerimento também traz os nomes em negrito, no PDF e no Word.
- O cônjuge entra na qualificação ("casado com NOME, CPF nº ..., sob o regime ..."), sem presumir o gênero.
- No Assinador, a lista de documentos assinados fica sempre aberta e ganha o botão "Baixar". Ela inclui os documentos assinados dentro de um pedido.

## Non-goals

- Mudar o banco: o requerente e o cônjuge vão no JSON da guia, com valores padrão, e as guias antigas seguem válidas.
- Pedir guia sem conta: continua pelo formulário de serviços do site.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `utilitarios`: o pedido de guia pelo site e a guia emitida passam a identificar o requerente, as partes e o cônjuge.

## Impact

- `src/core/guides/` (schema, qualificação, documento, pedido), `src/core/text/rich.ts`, `src/lib/pdf.ts`, `src/lib/guide-files.ts`, `src/lib/service-request.ts`.
- Formulário do site (`src/app/(public)/solicitar/`), formulário do painel (`utilitarios/guias/guide-form.tsx`), página do Assinador.
