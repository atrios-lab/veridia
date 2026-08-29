## Context

O texto da exigência é validado por `requirementTextSchema` (`src/core/request/requirement.ts`), que hoje faz `trim` + `replace(/\s+/g, " ")` — matando quebras de linha — e corta em 500 com "Texto longo demais.". A coluna no banco é `text`, sem limite. No mesmo cartão da exigência, a conversa (`messageBodySchema`, `src/core/chat/message.ts`) já aceita 4000 caracteres, faz só `trim` e renderiza com `whitespace-pre-line` dos dois lados. Os campos `purpose`/`description` da correção de dados (`src/core/request/edit.ts`) têm `.max(500)`/`.max(1000)` sem mensagem — estouro vira erro cru do Zod.

O e-mail nunca carrega o texto da exigência (só avisa que ela existe), e o texto não vai para PDF; os únicos renders são o detalhe do pedido no painel e o cartão na consulta de protocolo.

## Goals / Non-Goals

**Goals:**
- Exigência escrita como uma pessoa escreve: parágrafos, listas, quebras — exibida igual nos dois lados.
- Um teto de acidente (4000), não um orçamento de escrita; erro que diz o número quando bater.
- `purpose`/`description` do edit com o mesmo tratamento (mesma causa, mesmo autor).

**Non-Goals:**
- Contador de caracteres, `maxLength` no textarea, markdown, limite configurável, "ver mais" no cartão público — ver não-objetivos do proposal.
- Mexer nos limites dos formulários do cidadão anônimo.

## Decisions

**1. Reutilizar `MAX_MESSAGE_LENGTH` em vez de inventar constante nova.**
A constante já significa "explicação longa escrita por uma pessoa" e vive em `src/core/chat/message.ts`, núcleo puro. Importar de `core/chat` em `core/request` é aceitável: já existe acoplamento conceitual (a conversa da exigência usa esse schema). Alternativa considerada: constante própria `MAX_REQUIREMENT_LENGTH = 4000` — rejeitada por duplicar um número que deve andar junto; se um dia divergirem de propósito, aí sim se separa.

**2. `transform(trim)` apenas, sem normalizar whitespace interno.**
O `replace(/\s+/g, " ")` era a metade invisível do bug: mesmo texto dentro do limite perdia a estrutura. `messageBodySchema` é o precedente — só `trim`. Espaços duplicados internos são inofensivos.

**3. Mensagem de erro com o número: "O texto pode ter até 4.000 caracteres."**
"Texto longo demais." não diz quanto é demais. Com teto em 4000 quase ninguém verá o erro, mas quem vir (paste) precisa saber o alvo. Mesma mensagem nos três campos (exigência, finalidade, descrição), com o número interpolado da constante para não dessincronizar.

**4. Render com `whitespace-pre-line`, não `<br/>` nem markdown.**
É o padrão já usado 5× no projeto (bolhas da conversa, editais, descrição do pedido). CSS puro, zero parse, zero risco de injeção.

**5. `rows={4}` nos textareas de registrar e editar exigência.**
A caixa de 2 linhas comunicava "escreva uma frase". Quatro linhas comunica "explique". Sem autosize por JS — o textarea nativo já redimensiona no canto.

**6. `purpose`/`description` do edit: teto 4000 com a mesma mensagem.**
Hoje 500/1000 sem mensagem. Igualar a 4000 em vez de manter dois números distintos: são campos de texto livre escritos por operador autenticado, mesma categoria, mesma regra. Alternativa: só adicionar mensagem mantendo 500/1000 — rejeitada porque o número continua arbitrário e o Joelison bateria nele pelo caminho do edit.

## Risks / Trade-offs

- [Exigência de 4000 caracteres alonga o cartão público] → Aceito de propósito: o cidadão precisa ler tudo para resolver. Se incomodar, vira decisão de layout futura (não-objetivo aqui).
- [Textos antigos já achatados no banco continuam num parágrafo só] → Sem migração retroativa: o achatamento perdeu a informação; nada a recuperar. Textos novos nascem certos, e a exigência pendente pode ser editada.
- [Import de `core/chat` dentro de `core/request`] → Núcleo puro importando núcleo puro, sem ciclo: `message.ts` importa só zod (o import inverso que existe é `chat/conversation.ts` → `request/form.ts`, que não toca `requirement.ts`). Verificado no grafo atual.

## Migration Plan

Nenhuma migração: coluna `text` já sem limite, sem mudança de schema de banco, sem dois deploys. Deploy normal; rollback é reverter o commit.

## Open Questions

Nenhuma.
