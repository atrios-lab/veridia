## Why

`videos-aula-no-painel` entregou o módulo Treinamento com o catálogo de vídeos em código: publicar
um vídeo é subir o arquivo pelo painel da Vercel, editar `catalog.ts` e abrir PR. O design
previu que "quando a lista for grande o bastante para doer, ela vira tabela". Doeu antes do
primeiro vídeo: quem grava os vídeos é a Átrios, não quem escreve código, e não existe hoje
nenhum lugar no sistema onde a conta da plataforma (o papel `superadmin`, que entra em qualquer
serventia) faça algo que valha para todas as serventias de uma vez.

Esta change troca o catálogo em código por uma tabela global e dá à conta da Átrios uma tela no
próprio painel para subir, ordenar, publicar e remover os vídeos. Toda serventia vê o resultado
no mesmo instante, sem deploy.

## What Changes

- **Catálogo vira tabela global `tutorials`**, sem `tenant_slug`: a primeira tabela do projeto
  editável pela plataforma e lida por todas as serventias. `TUTORIALS` em código deixa de
  existir; as funções puras de trilha, rota e ordem continuam recebendo o catálogo como
  argumento, agora vindo do banco.
- **Tela de gerenciamento em `/admin/ajuda/gerenciar`**, só para quem tem a permissão nova
  `tutorials.manage`, que só o papel `superadmin` possui. Lista todos os vídeos na ordem da
  trilha, com "Novo vídeo", editar, subir e descer, publicar e despublicar, e excluir.
- **Upload pelo painel, direto do navegador para o Blob**, pelo mesmo mecanismo dos anexos do
  cidadão: uma rota emite o token, o arquivo nunca passa pela função. MP4 até 500 MB e legenda
  WebVTT opcional. Em desenvolvimento sem Blob, cai em disco sob `public/`, como as imagens de
  marca, com o vídeo limitado ao que a server action aceita.
- **Rascunho e publicado.** Um vídeo entra como rascunho, visível só na tela de gerenciamento,
  com player para conferir. Publicar é o que o coloca em `/admin/ajuda` e na trilha de toda
  serventia. Despublicar tira sem apagar.
- **Duração lida do arquivo** no navegador, no momento da escolha, e gravada com o vídeo. A
  Átrios não digita minutos.
- **Aviso na tela de gerenciamento**: o conteúdo é da plataforma e aparece em todas as
  serventias, independente da serventia em que a conta está logada.
- **Progresso passa a referenciar a tabela**: `tutorial_progress.video_id` ganha chave
  estrangeira com `on delete cascade`. Excluir um vídeo leva o progresso junto.
- **CSP**: `media-src` volta a derivar de `BLOB_PUBLIC_HOST`, já que o middleware não consulta
  o banco. Em desenvolvimento, `'self'` serve os arquivos em `public/`.
- **Sidebar**: o item "Treinamento" aparece para todos quando há ao menos um vídeo publicado, e
  sempre para quem pode gerenciar. A tela `/admin/ajuda` oferece "Gerenciar vídeos" a quem pode.
- **Auditoria** das ações da plataforma sob o slug `atrios`, o mesmo sentinela que a conta já
  usa como serventia.
- **BREAKING**: nenhuma para a serventia. Para o código, `TUTORIALS` e `mediaHosts` deixam de
  existir; a migração altera `tutorial_progress.video_id` de `text` para `uuid` com a tabela
  ainda vazia.

## Capabilities

### New Capabilities
- `admin-tutorials-management`: a tela da plataforma para subir, ordenar, publicar e excluir
  vídeos de treinamento, a permissão `tutorials.manage` exclusiva do papel `superadmin` que a
  protege, e o upload direto ao Blob.

### Modified Capabilities
- `admin-tutorials`: "Catálogo de vídeos de treinamento da plataforma" passa a ser a tabela
  `tutorials`, com rascunho e publicado; "Tela de vídeos de treinamento" lista só publicados e
  aceita legenda ausente; "Vídeo toca no painel" muda a origem permitida da mídia para o store
  do deploy; "Progresso é da pessoa" ganha a exclusão em cascata.
- `admin-shell`: "Grupo Ajuda com o item de vídeos de treinamento" passa a condicionar o item a
  haver vídeo publicado, com exceção para quem gerencia.

## Impact

- `src/core/auth/roles.ts`: `PLATFORM_PERMISSIONS = ["tutorials.manage"]`; `admin` recebe
  `PERMISSIONS` menos as de plataforma; `superadmin` tudo. Testes.
- `src/core/tutorials/`: `catalog.ts` vira só o tipo `Tutorial` (mesma forma, `captionsUrl`
  nullable) e as regras de validação do vídeo (`video.ts`: tipos, tamanhos, caminho gerado,
  schema Zod do formulário); `progress.ts` perde `mediaHosts`.
- `src/db/schema.ts` + migração 0023: tabela `tutorials`; `tutorial_progress.video_id` para
  `uuid` com FK cascade.
- `src/lib/tutorials.ts`: `listPublishedTutorials`, `listAllTutorials`, `createTutorial`,
  `updateTutorial`, `setTutorialPublished`, `moveTutorial`, `deleteTutorial`,
  `publishedTutorialCount`. `src/lib/uploads.ts`: `storeTutorialFile` (Blob ou disco).
- `src/app/api/treinamento/upload/route.ts`: token de upload direto, gated por sessão e
  `tutorials.manage`.
- `src/app/admin/(dashboard)/ajuda/gerenciar/`: `page.tsx`, `actions.ts`, `_components/`
  (formulário com upload direto e leitura da duração, lista com ordem e publicação).
- `src/app/admin/(dashboard)/ajuda/page.tsx`: lê do banco, só publicados; ação "Gerenciar
  vídeos". `layout.tsx` e `sidebar.tsx`: item condicionado a `publishedTutorialCount()` ou à
  permissão. `page-header.tsx` e `(dashboard)/page.tsx`: leem o catálogo do banco.
- `src/middleware.ts` e `src/lib/csp.ts`: `media-src` de `BLOB_PUBLIC_HOST`.
- Specs: nova `admin-tutorials-management`; deltas em `admin-tutorials` e `admin-shell`.
- Sem dependência nova.

## Non-Goals

- Upload pela serventia ou vídeos por serventia: a tela é da plataforma.
- Transcodificação, miniatura gerada, streaming adaptativo: um MP4 por vídeo, como está.
- Legenda obrigatória: opcional no upload, com aviso "sem legenda" na tela de gerenciamento.
- Editor de legenda no painel.
- Relatório de quem assistiu, por serventia.
- Uma "área da plataforma" genérica no painel (lista de serventias, métricas): esta é a primeira
  tela com esse caráter, e o design registra o padrão para as próximas, mas nenhuma outra entra
  aqui.
