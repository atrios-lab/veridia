## Context

A tela `/admin/ajuda` mostra os vídeos da tabela `tutorials`: um destaque com o player e prateleiras "Primeiros passos" e "Aprofundamento" (change `treinamento-em-vitrine`). O progresso é por pessoa e por vídeo (`tutorial_progress`). O card da Visão geral e o link "Como usar esta tela" leem a mesma tabela, pelo campo `trail` e pela `route`.

O curso de LGPD (`~/curso-lgpd-cartorios/out/`) traz:
- dois vídeos do avatar: Apresentação (1:19, 108 MB) e Encerramento (1:08, 93 MB);
- 12 aulas de 18 a 29 MB, com 38:39 no total;
- uma apostila em PDF de 14 páginas.

As legendas estão gravadas na imagem. É um curso para ser feito em ordem, e o fim dele leva à avaliação da change `avaliacao-e-certificado`.

## Goals / Non-Goals

**Goals:**
- Separar cada curso, com catálogo e página própria, sem quebrar o que já existe: trilha, card da Visão geral e "Como usar esta tela".
- Ordem obrigatória nos cursos sequenciais, com o servidor como juiz do que está aberto.
- Reaproveitar a vitrine para cursos de consulta e uma lista numerada para cursos sequenciais.

**Non-Goals:**
- Avaliação e certificado (outra change), obrigatoriedade, relatórios e restrição por papel (ver proposal).

## Decisions

### 1. Curso como tabela, vídeo com curso e tipo

```
courses
  id uuid, slug text unique, title, description,
  poster_path text null, material_path text null,      -- capa, apostila
  sequential boolean,                                    -- LGPD sim, painel não
  position int, published_at timestamptz null,
  created_at, updated_at, created_by

tutorials
  + course_id uuid not null references courses on delete restrict
  + kind text check in ('intro','lesson','outro') default 'lesson'
    position: agora a ordem dentro do curso
```

O número da aula não é uma coluna: ele é calculado pela posição entre os itens `lesson` publicados do curso. Assim, publicar ou despublicar uma aula renumera sozinho e nunca deixa buraco.

Em cada curso, `intro` vem sempre primeiro e `outro` sempre por último, qualquer que seja a posição gravada. A ordem fica na regra pura, não depende do formulário.

Excluir um curso que ainda tem vídeos é recusado (`restrict`). Primeiro mova ou exclua os vídeos, para não apagar progresso por engano.

*Alternativa considerada*: uma coluna `category` em `tutorials`, sem tabela. Descartada porque um curso precisa de capa, apostila, flag de sequência e, na outra change, nota mínima e carga horária.

### 2. Migração cria "Uso do painel"

Na mesma migração:
1. cria `courses`;
2. insere o curso `uso-do-painel` (consulta, publicado);
3. adiciona `course_id` como anulável, preenche todos os vídeos com esse curso e torna a coluna obrigatória.

`trail` e `route` continuam como estão: só fazem sentido nesse curso. O formulário esconde os dois campos quando o curso escolhido é sequencial, e a regra pura ignora `trail` fora do curso `uso-do-painel`.

### 3. Rotas

```
/admin/ajuda                        catálogo
/admin/ajuda/<slug>                 página do curso
/admin/ajuda/<slug>?video=<id>      página do curso com esse item no player
/admin/ajuda?video=<id>             redireciona (308) para /admin/ajuda/<slug do curso>?video=<id>
/admin/ajuda/gerenciar              continua (segmento estático vence o dinâmico)
```

O slug `gerenciar` fica reservado: o schema do formulário de curso recusa esse valor.

Para um curso não publicado, um slug inexistente ou um curso que a pessoa não pode ver, a página responde `notFound()`. O catálogo nunca linka para nada disso.

### 4. Catálogo

```
Treinamento
┌─ Continue de onde parou ──────────────────────────────────┐
│ [capa]  LGPD no cartório · Aula 3: Quando informar  [▶]   │
└───────────────────────────────────────────────────────────┘
Cursos
┌──capa──┐ ┌──capa──┐
│        │ │        │
Uso do painel        LGPD no cartório
7 vídeos · 18 min    14 vídeos · 41 min
██░░░░ 2 de 7        █░░░░░ 3 de 14
```

O destaque "Continue de onde parou" mostra o item seguinte ao último assistido pela pessoa, pela data em `tutorial_progress`, dentro do curso desse último. Se ela nunca assistiu a nada, mostra o primeiro item do primeiro curso publicado. Se terminou tudo, o destaque some.

### 5. Página do curso sequencial

```
← Treinamento
LGPD no cartório                          [Apostila (PDF)]
14 vídeos · 41 min · 3 de 14 assistidos   ███░░░░░░░░░
┌──────────── player ─────────────┐  ┌ Conteúdo ──────────────┐
│                                  │  │ ✓  Apresentação        │
│                                  │  │ ✓  Aula 1  O que é...  │
└──────────────────────────────────┘  │ ▶  Aula 2  Quais dados │
Aula 2 de 12 · Quais dados…           │ 🔒 Aula 3  Quando...   │
descrição                             │ 🔒 …                   │
[Próxima aula →] (aparece ao terminar)│ 🔒 Encerramento        │
                                      └────────────────────────┘
```

A lista é a mesma de antes da vitrine: numerada, com o check de assistido, e o cadeado agora como estado novo. Num item fechado:
- a linha aparece com `aria-disabled` e sem link;
- ao passar o mouse, o texto diz "Abre depois de assistir à Aula N";
- um `?video=` que aponta para ele abre o primeiro item ainda aberto, sem erro.

Num curso de consulta, a página é a vitrine atual, sem mudanças, só que filtrada para os vídeos do curso.

### 6. Regra de sequência (pura, em `src/core/tutorials/`)

```
unlockedIds(items em ordem, watchedIds):
  se todos assistidos → todos
  senão → itens até o primeiro não assistido, inclusive
```

Essa mesma função decide o que a página mostra e o que a server action aceita. `markTutorialWatchedAction` passa a recusar um id de curso sequencial que não está em `unlockedIds`. Desmarcar não existe em curso sequencial: sem o botão, a action recusa.

### 7. Assistido só ao fim, sem adiantar

No `TutorialPlayer`, quando o curso é sequencial:
- Não há botão de marcar ou desfazer.
- O player guarda o ponto mais distante já tocado (`maxReached`). No evento `seeking`, se `currentTime > maxReached + 1`, volta para `maxReached`. Voltar e reassistir são livres.
- `ended` marca como assistido, como hoje.
- Um item já assistido toca sem restrição de adiantar.
- `playbackRate` não é limitado (ver Non-goals).

O `maxReached` fica só na memória da página: recarregar recomeça do zero. É uma barreira contra pular o vídeo, não contra quem queira fraudar o navegador. A avaliação da outra change é o que mede o aprendizado.

### 8. Apostila e capa do curso

`TutorialFileKind` ganha `"material"` (`application/pdf`, até 20 MB, extensão `pdf`). A capa do curso reaproveita o tipo `"poster"`. Os dois sobem pela rota de token que já existe, sob `treinamento/`, como os vídeos.

A apostila abre em nova aba pelo link público do Blob. Ela é conteúdo do curso, sem dado pessoal.

### 9. O que continua olhando só para "Uso do painel"

- `trailProgress`, `nextUnwatched` e o card da Visão geral recebem só os vídeos de `uso-do-painel`.
- `tutorialForRoute` ("Como usar esta tela") considera só vídeos com `route`, o que na prática já é o curso do painel.
- O item "Treinamento" do menu aparece se existir algum curso publicado com algum vídeo publicado.

## Risks / Trade-offs

- [Vídeos de 93 a 108 MB do avatar demoram a carregar] → `preload="metadata"`, capa como pôster. O upload direto aceita até 500 MB.
- [O bloqueio de adiantar dá para contornar] → é uma barreira declarada, não uma garantia. Quem mede o aprendizado é a avaliação.
- [Renumeração das aulas ao despublicar uma do meio] → é intencional, para a lista nunca ter buraco. O título de cada aula não traz o número, então não há texto para corrigir.
- [Outra change com deltas na mesma spec] → `treinamento-em-vitrine` é arquivada primeiro (tarefa 1.1). Os deltas daqui foram escritos sobre o texto dela.
- [Link antigo `/admin/ajuda?video=` em e-mails e favoritos] → redirect 308 para a página do curso.

## Migration Plan

1. Arquivar `treinamento-em-vitrine`, depois de conferir o envio de capa.
2. Gerar a migração (tabela, curso `uso-do-painel`, `course_id` preenchido e obrigatório, `kind`).
3. Aplicar no Homolog pelo pooler e conferir que a página do painel e o card da Visão geral continuam iguais.
4. Antes do merge, aplicar em produção via `POSTGRES_URL_NON_POOLING`.
5. Depois do deploy, cadastrar o curso de LGPD pela tela de gerenciamento:
   - capa e apostila;
   - Apresentação, Aulas 1 a 12 e Encerramento;
   - Encerramento em rascunho;
   - publicar o curso.

Rollback: o código anterior ignora `courses` e as colunas novas. Reverter o deploy basta, e os dados ficam.

## Open Questions

- Títulos das 12 aulas para a lista. Proposta: tirar do roteiro ("O que é a LGPD e quem faz o quê", "Quais dados passam pelas suas mãos"…) e conferir com o usuário no cadastro.
- Capa do curso e das 14 aulas: seguir o modelo das capas do Treinamento, com print das cenas do Remotion em vez de tela do painel.
