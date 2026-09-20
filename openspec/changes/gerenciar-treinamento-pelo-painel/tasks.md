## 1. Permissão de plataforma

- [x] 1.1 `src/core/auth/roles.ts`: `OFFICE_PERMISSIONS` (as dez de hoje), `PLATFORM_PERMISSIONS
  = ["tutorials.manage"]`, `PERMISSIONS` como a união; `admin` recebe `OFFICE_PERMISSIONS`,
  `superadmin` recebe `PERMISSIONS`; comentário explicando a divisão.
- [x] 1.2 `roles.test.ts`: `admin` não tem nenhuma permissão de plataforma; `admin` tem todas as
  da serventia; `superadmin` tem `tutorials.manage`; `staff` não.

## 2. Núcleo: tipo, validação e ordem

- [x] 2.1 `src/core/tutorials/catalog.ts`: remover `TUTORIALS`; `Tutorial.captionsUrl` vira
  `string | null`; refazer o comentário do arquivo (o catálogo é a tabela `tutorials`, escrita
  pela plataforma, lida por todos).
- [x] 2.2 `src/core/tutorials/video.ts`: `TUTORIAL_FOLDER = "treinamento"`, tipos aceitos
  (`video/mp4`, `text/vtt`), `MAX_VIDEO_BYTES_DIRECT = 500 MB`, `MAX_VIDEO_BYTES_SERVER_ACTION =
  100 MB`, `MAX_CAPTIONS_BYTES = 1 MB`, `tutorialFilePath(kind, id)` e
  `isGeneratedTutorialPath(pathname)`, `checkTutorialFile(file, kind, limit)`, e o schema Zod
  do formulário (`title` 1..120, `description` 0..500, `durationSeconds` inteiro > 0, `route`
  em `ADMIN_NAV` interno ou vazio, `trail` boolean). Testes em `video.test.ts`.
- [x] 2.3 `progress.ts`: remover `mediaHosts`; `progress.test.ts` e `catalog.test.ts` ajustados
  (o teste do catálogo em código sai; o que sobrevive vai para `video.test.ts`).

## 3. Banco

- [x] 3.1 `src/db/schema.ts`: tabela `tutorials` conforme o design (decisão 1), índice em
  `published_at` e em `position`; `tutorialProgress.videoId` vira `uuid` com `references(() =>
  tutorials.id, { onDelete: "cascade" })`. Comentário registrando o padrão de tabela global.
- [x] 3.2 `pnpm db:generate`, revisar: `CREATE TABLE tutorials`, `ALTER TABLE tutorial_progress
  ALTER COLUMN video_id TYPE uuid USING video_id::uuid`, FK. Se o drizzle-kit gerar o ALTER sem
  `USING`, editar à mão.
- [x] 3.3 `src/lib/tutorials.ts`: `listPublishedTutorials()` e `listAllTutorials()` (ordenadas por
  `position`, mapeadas para `Tutorial`), `publishedTutorialCount()`, `createTutorial(input,
  files, actorId)`, `updateTutorial(id, input, files?, actorId)`, `setTutorialPublished(id,
  published, actorId)`, `moveTutorial(id, direction, actorId)` (troca `position` com o vizinho
  numa transação), `deleteTutorial(id, actorId)` (apaga arquivos do store, depois a linha), todas
  com variante `...With(db)`. `markWatched` passa a exigir vídeo publicado. Auditoria sob
  `SUPERADMIN_TENANT_SLUG`.
- [x] 3.4 `src/db/tutorials.test.ts`: criar rascunho fica fora de `listPublishedTutorials`;
  publicar entra; mover troca posições; excluir leva o progresso; despublicar preserva; marcar
  progresso em rascunho é recusado.

## 4. Armazenamento e CSP

- [x] 4.1 `src/lib/uploads.ts`: `storeTutorialFile(bytes, kind, id, mimeType)` (Blob em
  `treinamento/<id>.<ext>` ou disco em `public/uploads/treinamento/`, devolvendo URL pública ou
  caminho `/uploads/treinamento/...`), reaproveitando `assertDiskFallbackAllowed` e
  `deleteStoredFile`.
- [x] 4.2 `src/app/api/treinamento/upload/route.ts`: 404 sem `BLOB_READ_WRITE_TOKEN`; 404 sem
  sessão ou sem `tutorials.manage`; `handleUpload` com `isGeneratedTutorialPath`, tipos e limite
  por extensão do caminho; `addRandomSuffix: false` (o id já é único e a linha guarda a URL).
- [x] 4.3 `src/lib/csp.ts`: `media-src 'self'` mais `https://<blobPublicHost>` quando definido;
  remover `mediaHosts` do `CspInput`; `csp.test.ts` ajustado. `src/middleware.ts` deixa de
  importar o catálogo.

## 5. Tela de gerenciamento

- [x] 5.1 `ajuda/gerenciar/actions.ts`: `createTutorialAction`, `updateTutorialAction`,
  `publishTutorialAction`, `unpublishTutorialAction`, `moveTutorialAction`,
  `deleteTutorialAction`; todas exigem `tutorials.manage`; criação e edição aceitam ou os
  arquivos (server action, modo disco) ou as URLs já enviadas ao store (modo direto), validando
  que a URL está sob a pasta de treinamento do host do store; `revalidatePath` de `/admin/ajuda`,
  `/admin/ajuda/gerenciar` e `/admin`.
- [x] 5.2 `ajuda/gerenciar/_components/tutorial-form.tsx` (client): campos do formulário, `<select>`
  da tela ensinada com os itens internos de `ADMIN_NAV`, leitura da duração por `<video>` fora
  da tela em `loadedmetadata`, upload direto com `upload()` e `multipart: true` quando
  `enabled`, barra de progresso, validação de tipo e tamanho antes de enviar; no modo disco,
  envia os arquivos no `FormData`. Reusado para editar (arquivos opcionais).
- [x] 5.3 `ajuda/gerenciar/_components/tutorial-admin-list.tsx`: linha por vídeo com posição,
  selo "Rascunho", "sem legenda", tela ensinada, duração, botões subir/descer, publicar ou
  despublicar, editar (abre o formulário), excluir via `ConfirmAction` com o aviso do progresso,
  e "Conferir" que expande o player.
- [x] 5.4 `ajuda/gerenciar/page.tsx`: `notFound()` sem `tutorials.manage`; aviso fixo de conteúdo
  da plataforma; `AdminPageHeader` com `back` para `/admin/ajuda` e ação "Novo vídeo"; lista e
  formulário; passa `enabled` do Blob ao cliente.

## 6. Leitura pelo banco

- [x] 6.1 `ajuda/page.tsx`: `listPublishedTutorials()` no lugar de `TUTORIALS`; id de rascunho cai
  no fallback; ação "Gerenciar vídeos" no cabeçalho para quem tem `tutorials.manage`;
  `tutorial-player.tsx` só renderiza `<track>` com legenda; `ajuda/actions.ts` valida contra os
  publicados.
- [x] 6.2 `(dashboard)/page.tsx` e `page-header.tsx`: catálogo via `listPublishedTutorials()`
  (o cabeçalho faz a consulta só quando há `x-pathname`, e ela é uma leitura leve com índice).
- [x] 6.3 `layout.tsx`: `publishedTutorialCount()`; `showTutorials = count > 0 || can(role,
  "tutorials.manage")` passado a `AdminSidebar`, que substitui o `TUTORIALS.length === 0`.
  `nav.test.ts` intacto.

## 7. Fechamento

- [ ] 7.1 Migração 0023 no Homolog (pooler em modo sessão, aplicada em 19/09) e em produção
  (`POSTGRES_URL_NON_POOLING`), antes do merge.
- [ ] 7.2 Conferir no navegador como `superadmin`: subir um MP4 com legenda em modo disco, ver o
  rascunho, publicar, ver em `/admin/ajuda` de outra serventia, mover, despublicar, excluir. Como
  `admin`: 404 em `/admin/ajuda/gerenciar`, sem "Gerenciar vídeos". Sem erro de CSP.
- [ ] 7.3 `pnpm typecheck`, `pnpm lint`, `pnpm test`; PR em cima de
  `claude/admin-tutorial-videos-module-1f08f1`, ou na mesma branch se o #129 ainda não tiver sido
  mergeado. Ao arquivar, arquivar `videos-aula-no-painel` antes desta.
