## 1. Antes de começar

- [ ] 1.1 Conferir o envio de capa da `treinamento-em-vitrine` (tarefa 4.3 dela), marcar 4.3 e 5.1 e arquivá-la, para a spec principal ter o texto sobre o qual estes deltas foram escritos

## 2. Dados

- [ ] 2.1 Tabela `courses` em `src/db/schema.ts` e colunas `course_id` e `kind` em `tutorials`
- [ ] 2.2 Migração Drizzle que cria `courses`, insere `uso-do-painel` (consulta, publicado), liga os vídeos existentes a ele e torna `course_id` obrigatório; conferir o SQL gerado
- [ ] 2.3 `src/core/tutorials/catalog.ts`: tipos `Course` e `TutorialKind`, e curso e tipo no `Tutorial`
- [ ] 2.4 Regras puras com testes em `node --test`: ordem do curso (Apresentação primeiro, Encerramento por último), número das aulas publicadas, `unlockedIds`, andamento por curso, "Continue de onde parou" e trilha restrita a `uso-do-painel`
- [ ] 2.5 `TutorialFileKind` ganha `material` (PDF, 20 MB) em `video.ts`, com testes de caminho, tipo e limite; a rota de token aceita o tipo novo

## 3. Leitura e escrita

- [ ] 3.1 `src/lib/courses.ts`: listar cursos publicados com vídeos, buscar por slug, criar, editar, ordenar, publicar e excluir (recusando curso com vídeos), auditando sob a plataforma; testes contra PGlite
- [ ] 3.2 `src/lib/tutorials.ts`: listar por curso, posição contada dentro do curso, mover só dentro do curso, recusar segunda Apresentação ou Encerramento, levar à última posição ao trocar de curso; testes contra PGlite
- [ ] 3.3 `markTutorialWatchedAction` recusa item fechado de curso sequencial e `unmarkTutorialWatchedAction` recusa aula de curso sequencial, com a regra descida para uma função `...With(db)` testada contra PGlite

## 4. Telas

- [ ] 4.1 `/admin/ajuda`: catálogo com "Continue de onde parou" e cards de curso (capa, vídeos, duração, andamento); redirect 308 de `?video=<id>` para a página do curso; estado sem cursos
- [ ] 4.2 `/admin/ajuda/[curso]/page.tsx`: curso de consulta reaproveita a vitrine filtrada pelo curso; curso sequencial mostra player, lista numerada com assistido, aberto e fechado, link da apostila e "Próxima aula"
- [ ] 4.3 `TutorialPlayer` em modo sequencial: sem marcar ou desfazer, `maxReached` bloqueando o adiantar enquanto não assistido, "Próxima aula" ao terminar
- [ ] 4.4 Card da Visão geral, link "Como usar esta tela" e item do menu passam a olhar só para o curso `uso-do-painel` (e o menu para cursos publicados)
- [ ] 4.5 Gerenciamento: lista de cursos com criar, editar (capa, apostila, sequencial, slug), ordenar, publicar e excluir; formulário de vídeo com curso e tipo, escondendo tela ensinada e trilha em curso sequencial; lista de vídeos agrupada por curso

## 5. Conferência

- [ ] 5.1 Rodar os testes tocados, `pnpm typecheck` e `pnpm lint`
- [ ] 5.2 Conferir no navegador pelo host do cartório: catálogo, página do painel igual à de antes, curso sequencial com cadeado, próxima aula abrindo, adiantar bloqueado, rever livre, redirect do link antigo, celular
- [ ] 5.3 Aplicar a migração no Homolog pelo pooler e conferir o card da Visão geral e o "Como usar esta tela"

## 6. Produção e conteúdo

- [ ] 6.1 Antes do merge, aplicar a migração em produção via `POSTGRES_URL_NON_POOLING`
- [ ] 6.2 Montar a capa do curso e as capas dos 14 vídeos do LGPD no modelo das capas do Treinamento
- [ ] 6.3 Cadastrar o curso "LGPD no cartório" pela tela: capa, apostila, Apresentação, Aulas 1 a 12 com títulos conferidos, Encerramento em rascunho; publicar o curso
