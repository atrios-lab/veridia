## Why

As guias começavam sempre em 001 no ano, mas uma serventia que já vinha numerando à mão (por exemplo, as
guias já estão na 019/2026 no livro) precisa que a plataforma continue de onde parou. O mesmo vale para os
protocolos dos pedidos, agendamentos, LGPD e ouvidoria.

## What Changes

- Nova aba **Configurações › Numeração** (permissão `content.edit`) que lista **todo documento numerado**
  do catálogo (`src/core/numbering/series.ts`): guias de recolhimento, pedidos de serviço, agendamentos,
  requerimentos LGPD e ouvidoria. Um documento numerado novo entra no catálogo e aparece na aba sozinho.
- Para cada um: o último número usado e o próximo, no ano atual e no ano seguinte, e o campo **Próximo
  número** por ano.
- O próximo número é o maior entre o informado e o último usado mais um: **nunca repete**. Número já
  usado é recusado, dizendo o próximo livre.
- Guias já emitidas continuam com "Alterar número" na própria guia. Protocolos já entregues não mudam,
  porque o cidadão já tem o número e o Pix está ligado a ele.
- Fica em `tenant_content` (`office-numbering`), com auditoria. **Banco: nenhuma migração.**
