## Context

`src/core/compliance/sections.ts` é a única fonte da lista de seções (`SECTIONS`), lida pela UI
(`section-form.tsx`, `page.tsx`, `revisao/page.tsx`) via `SECTIONS.length` e `section.number` — a
contagem e a barra de progresso já são derivadas, não hardcoded. `export.ts` lê as respostas por
`sectionId`/`name` com os helpers `text`/`label`/`multi` e monta o JSON no vocabulário do gerador
externo (`bom-jesus.json`, `ielmo-marinho.json`). Este change remove uma seção inteira (16 —
Formalidades) e um campo de outra seção (14 — Contratos e fornecedores, `sendAddendum`), e para de
exportar as seis chaves do gerador que só existiam por causa desses dois pontos.

## Goals / Non-Goals

**Goals:**
- Remover a Seção 16 e o campo `sendAddendum` de `sections.ts`, deixando `SECTIONS.length` cair
  para 16 sem nenhum outro código precisar saber o número exato de seções.
- Corrigir as duas referências textuais fixas a "Seção 17" (que passa a ser a 16) e o único
  `formalidades: {...}` de fixture em `compliance.test.ts`.
- Parar de gerar `aditivo_fornecedores`, `num_portaria_ultima`, `num_portaria_inicial`, `data`,
  `data_curta` e `sem_marca` no JSON exportado.

**Non-Goals:**
- Tocar em `compliance_intakes` (schema ou dados). Respostas antigas de `formalidades` e
  `sendAddendum` continuam no JSONB da serventia; só deixam de ser lidas.
- Mudar o gerador de documentos, que é externo a este repositório.
- Renumerar qualquer seção além da 17 → 16 (deslocamento mecânico de remover um item da lista).

## Decisions

- **Remover a seção da lista em vez de escondê-la (`showWhen`)**: o brief e o Provimento não
  preveem essa pergunta condicionalmente — ela simplesmente não é mais feita a ninguém. Manter o
  código morto de uma seção inteira (campos, help text, `id: "formalidades"`) só para nunca
  aparecer seria mais confuso do que apagá-la.
- **Excluir as chaves do JSON em vez de mandar valor fixo**: o gerador deixou de precisar dessas
  informações (confirmado com quem opera o gerador), então gerar `sem_marca: true` ou
  `num_portaria_inicial: "001"` por padrão seria inventar dado que ninguém validou. `toGeneratorJson`
  simplesmente para de incluir essas seis chaves; `signing`/`lastOrdinance` (variáveis locais só
  usadas para montá-las) saem junto.
- **Não migrar dados salvos**: como o schema (`compliance_intakes`, JSONB por seção) não distingue
  seção ativa de inativa, as respostas antigas de `formalidades` e `sendAddendum` ficam no banco
  sem serem lidas por nenhum código depois deste change — equivalente ao que já acontece quando
  qualquer campo de uma seção muda de nome ou some.

## Risks / Trade-offs

- [Serventia que já respondeu a Seção 16 ou o termo aditivo não vê mais essas respostas em lugar
  nenhum do painel, mesmo elas existindo no banco] → aceitável: nenhuma tela lista respostas de
  seções que não existem em `SECTIONS`; se precisarem ser recuperadas um dia, estão no JSONB.
- [Se o gerador externo ainda ler alguma das seis chaves removidas antes de ser atualizado do lado
  dele, o documento gerado fica com campo faltando] → mitigado fora deste change: a remoção das
  chaves foi confirmada como segura porque o gerador já não as consome; não há um "meio-termo" de
  deploy coordenado a fazer aqui.
- [`num_portaria_ultima` não tinha teste cobrindo sua presença em `compliance.test.ts`, só
  `num_portaria_inicial`] → sem risco de teste quebrado por isso; ambas saem juntas do `export.ts`
  e o teste é atualizado para não esperar nenhuma das duas.

## Migration Plan

Nenhuma migração de banco. Deploy único: mudança de UI (menos uma seção, menos um campo) e de
export (menos seis chaves) entram juntas. Sem rollback especial — reverter o commit restaura a
Seção 16, o campo e as chaves do JSON.
