## Context

`videos-aula-no-painel` deixou o lado de leitura pronto: `/admin/ajuda` com player nativo, o
card da trilha na visão geral, o link contextual no cabeçalho, a tabela `tutorial_progress`
por usuário e as funções puras em `src/core/tutorials/progress.ts`, que recebem o catálogo
como argumento. O catálogo é a constante `TUTORIALS`, vazia, e o `media-src` do CSP é derivado
dela por `mediaHosts`.

Peças que esta change reaproveita:

- **Upload direto ao Blob** (`src/app/api/anexos/upload/route.ts` e
  `(public)/_lib/attachments.tsx`): `handleUpload` emite um token para um caminho gerado pelo
  sistema, com tipos e tamanho permitidos; o navegador chama `upload()` do
  `@vercel/blob/client` e o arquivo nunca passa pela função da Vercel, cujo corpo é limitado a
  4,5 MB. Sem `BLOB_READ_WRITE_TOKEN` (desenvolvimento), o arquivo vai por server action e
  cai em disco; para as imagens de marca, sob `public/uploads/marca/`, servido pelo próprio
  Next. `serverActions.bodySizeLimit` é 110 MB.
- **Papéis** em `src/core/auth/roles.ts`: `admin` e `superadmin` recebem `PERMISSIONS`
  inteiro; `superadmin` é a conta da Átrios, criada só por script, com o slug sentinela
  `atrios` como serventia, e `canAccessTenant` a deixa entrar em qualquer serventia registrada.
- **Auditoria** (`src/lib/audit.ts`) exige `tenantSlug`.
- **Sidebar**: o layout já consulta contadores por item antes de renderizar; `sidebar.tsx`
  filtra por permissão e, hoje, esconde "Treinamento" com `TUTORIALS.length === 0`.

## Goals / Non-Goals

**Goals:**
- A conta da Átrios sobe, ordena, publica e remove vídeos pelo painel, sem deploy.
- O que ela publica aparece em todas as serventias no mesmo instante.
- Nenhuma serventia ganha poder sobre o conteúdo da plataforma, nem por acidente.
- O arquivo de vídeo não passa pela função da Vercel.

**Non-Goals:**
- Área da plataforma genérica no painel; vídeos por serventia; transcodificação.

## Decisions

### 1. Tabela `tutorials`, global, e o tipo `Tutorial` vira a linha

```
tutorials
  id               uuid pk default random
  title            text not null
  description      text not null default ''
  duration_seconds integer not null
  video_path       text not null      -- URL do Blob ou caminho público em dev
  captions_path    text               -- null: sem legenda
  route            text               -- null: vídeo sobre o painel inteiro
  trail            boolean not null default true
  position         integer not null   -- ordem da trilha e da lista
  published_at     timestamptz        -- null: rascunho
  created_at, updated_at timestamptz not null default now()
  created_by       text               -- user.id de quem subiu
```

Sem `tenant_slug`, de propósito e pela primeira vez numa tabela editável: o conteúdo é da
plataforma. O comentário na tabela registra o padrão para o que vier depois: tabela global é
aquela cuja escrita exige uma permissão de plataforma (decisão 3) e cuja leitura é igual para
toda serventia.

`Tutorial` em `src/core/tutorials/catalog.ts` mantém a forma que o player e as funções puras
já consomem (`id`, `title`, `description`, `durationSeconds`, `videoUrl`, `captionsUrl`,
`route`, `trail`), com `captionsUrl` passando a `string | null`. `TUTORIALS` e `mediaHosts`
saem. As funções de `progress.ts` não mudam de assinatura: recebem a lista já ordenada por
`position` que o lib devolve.

`tutorial_progress.video_id` passa de `text` para `uuid` com chave estrangeira para
`tutorials.id` e `on delete cascade`. A migração apaga as linhas existentes antes de converter:
cada uma guardava o slug de uma entrada do catálogo em código, que a tabela nova não tem, e a
chave estrangeira recusaria todas. Produção não tem nenhuma (nenhum vídeo foi publicado).
Excluir um vídeo leva o progresso junto, que é o que se espera.

### 2. Upload direto ao Blob, com fallback em disco só em desenvolvimento

`src/app/api/treinamento/upload/route.ts` emite o token como a rota dos anexos, com três
diferenças: exige sessão com `tutorials.manage` (a rota dos anexos é pública, esta não);
aceita só `video/mp4` e `text/vtt`; e o limite é 500 MB para o vídeo. O caminho aceito é
`treinamento/<uuid>.mp4` ou `treinamento/<uuid>.vtt`, gerado no cliente e conferido pela
regex em `src/core/tutorials/video.ts`, como `isGeneratedAttachmentPath` faz. O cliente
chama `upload()` com `multipart: true`, que o SDK usa para arquivos grandes.

O mesmo store do deploy, numa pasta própria: não há motivo para um segundo store. Como o token
é por ambiente na Vercel, um vídeo subido no Homolog fica no store do Homolog e um subido em
produção fica no de produção. O Homolog serve de ensaio.

Sem `BLOB_READ_WRITE_TOKEN` (desenvolvimento), o formulário envia o arquivo pela server action
e `storeTutorialFile` grava em `public/uploads/treinamento/`, servido pelo Next em `'self'`,
como as imagens de marca. O vídeo fica limitado a 100 MB nesse caminho, abaixo do
`bodySizeLimit`; a validação em `video.ts` recebe o limite como parâmetro, então o cliente e o
servidor aplicam o mesmo número de acordo com o modo.

O formulário sabe o modo pelo mesmo sinal do site público: a página passa `enabled:
Boolean(process.env.BLOB_READ_WRITE_TOKEN)` ao componente cliente.

### 3. Permissão de plataforma, fora do que `admin` recebe

```ts
export const PLATFORM_PERMISSIONS = ["tutorials.manage"] as const;
export const PERMISSIONS = [...OFFICE_PERMISSIONS, ...PLATFORM_PERMISSIONS] as const;
ROLE_PERMISSIONS = {
  admin: OFFICE_PERMISSIONS,
  superadmin: PERMISSIONS,
  staff: [...],
};
```

`admin` hoje recebe `PERMISSIONS` inteiro, e uma permissão nova cairia no colo de todo
registrador. A divisão em duas listas é o que torna impossível esquecer: uma permissão de
plataforma nunca entra em `OFFICE_PERMISSIONS`, e o teste "admin não tem permissão de
plataforma" percorre a lista. `can()` não muda.

Alternativa: checar `role === "superadmin"` direto na tela. Descartada: o resto do painel
pergunta por permissão, não por papel, e a regra "esconder não é controle de acesso" precisa
de um nome para o que se checa no servidor.

### 4. Tela em `/admin/ajuda/gerenciar`, dentro da serventia em que a conta está

A conta da Átrios não tem "lugar próprio": ela entra pelo host de uma serventia e vê o painel
dela. A tela de gerenciamento fica na mesma casca, com um aviso fixo no topo: "Conteúdo da
plataforma. O que você publica aqui aparece no Treinamento de todas as serventias." Não há
item de sidebar próprio: quem tem `tutorials.manage` vê "Gerenciar vídeos" como ação do
cabeçalho de `/admin/ajuda`, e o item "Treinamento" da sidebar aparece para essa pessoa mesmo
sem vídeo publicado, porque é o caminho até o gerenciamento.

A tela lista todos os vídeos (rascunhos com selo), na ordem de `position`, com: subir e
descer, publicar e despublicar, editar, excluir com confirmação (`ConfirmAction`, dizendo que
o progresso das pessoas naquele vídeo some junto) e player de conferência ao expandir. "Novo
vídeo" abre o formulário: arquivo MP4 (obrigatório), legenda VTT (opcional), título,
descrição, tela ensinada (`<select>` com os itens internos de `ADMIN_NAV` e "Nenhuma, é sobre
o painel inteiro"), "faz parte dos primeiros passos". Editar reusa o formulário sem exigir
arquivo novo; trocar o arquivo apaga o anterior do store.

### 5. Duração lida do arquivo no navegador

Ao escolher o MP4, o componente cria um `<video>` fora da tela com `URL.createObjectURL`,
lê `duration` em `loadedmetadata` e preenche um campo oculto. O servidor exige um inteiro
positivo e não tenta ler o arquivo: `ffprobe` não existe na função e ler o `moov` de um MP4
sem biblioteca é trabalho que o navegador já fez.

### 6. Rascunho por padrão; só publicado sai da tela de gerenciamento

`published_at` nulo é rascunho. `listPublishedTutorials` alimenta `/admin/ajuda`, o card da
visão geral, o link contextual e a contagem da sidebar. `listAllTutorials` alimenta só a tela
de gerenciamento. Uma pessoa que abrir `/admin/ajuda?video=<id de rascunho>` cai no
comportamento de id inexistente, sem revelar nada. Despublicar mantém o progresso: quem já
assistiu continua com a marca quando o vídeo voltar.

### 7. `media-src` volta a `BLOB_PUBLIC_HOST`

O middleware roda no edge e não consulta o banco, então a origem da mídia não pode mais vir do
catálogo. `buildCsp` recebe `blobPublicHost` e monta `media-src 'self' https://<host>` quando
ele existe; `mediaHosts` sai do `CspInput`. Em desenvolvimento, sem host, o vídeo é servido de
`public/` e `'self'` basta. Essa é a reversão explícita da decisão 3 da change anterior: o
argumento de lá ("o Blob da serventia pode ser outro store") deixou de valer porque agora o
vídeo mora no mesmo store, por decisão 2.

### 8. Contagem para a sidebar no layout, uma consulta

`layout.tsx` já monta `counts` com uma consulta por item oferecido. Ganha
`publishedTutorialCount()` (um `count(*)` com índice em `published_at`) e passa
`showTutorials = count > 0 || can(role, "tutorials.manage")` ao `AdminSidebar`, que substitui
o `TUTORIALS.length === 0` de hoje.

### 9. Auditoria sob o slug `atrios`

`recordAudit` exige `tenantSlug`. As ações da plataforma são gravadas com
`SUPERADMIN_TENANT_SLUG` ("atrios"), nunca com a serventia em que a conta estava logada: o
que ela fez não é da serventia, e listar sob a serventia enganaria quem lesse a auditoria dela.
Ações: `tutorial.create`, `tutorial.update`, `tutorial.publish`, `tutorial.unpublish`,
`tutorial.move`, `tutorial.delete`, com `targetId` o uuid.

A única deleção que não é da plataforma é "Desfazer" numa marca de assistido
(`unmarkWatched`): o verificador `check:destructive` exige trilha em toda deleção, e ela vai
sob a serventia da sessão, como tudo que um usuário da serventia faz
(`tutorial-progress.unmark`). Marcar continua sem auditoria: é um insert idempotente.

## Risks / Trade-offs

- [Arquivo grande pela server action em dev estoura o body] → limite de 100 MB nesse modo,
  validado no cliente antes de enviar e no servidor.
- [Token de upload emitido e arquivo nunca associado a uma linha] → blob órfão, inofensivo;
  quem pode subir é uma conta só. Sem varredura nesta change.
- [Superadmin publica por engano num piscar] → rascunho por padrão; publicar é ação separada.
- [`ALTER COLUMN video_id TYPE uuid` com linha existente] → a migração apaga toda linha de
  `tutorial_progress` antes de converter, de propósito: cada uma aponta para um slug do catálogo
  em código, que não existe na tabela nova, e a chave estrangeira recusaria todas. Produção não
  tem nenhuma (nenhum vídeo foi publicado); o Homolog tinha marcas de teste, descobertas quando
  o `USING` falhou alto em 19/09, como previsto.
- [Um registrador ganhar `tutorials.manage` por engano] → só o papel `superadmin`, que não é
  atribuível pelo painel (`PANEL_ROLES`), e o teste percorre `OFFICE_PERMISSIONS`.
- [Primeira tabela global cria precedente confuso] → comentário na tabela e esta decisão 1
  fixam a regra: escrita exige permissão de plataforma, leitura igual para todos.

## Migration Plan

1. Migração 0023 (expande: tabela nova, FK e tipo numa tabela vazia). Homolog pelo pooler em
   modo sessão; produção pela `POSTGRES_URL_NON_POOLING`, antes do merge.
2. Deploy. A tela de gerenciamento entra vazia; a Átrios sobe o primeiro vídeo por ela.
3. Rollback: reverter o PR. A tabela `tutorials` pode ficar; `tutorial_progress.video_id`
   como `uuid` continua compatível com o código anterior enquanto a tabela estiver vazia.

## Open Questions

- Nenhuma que bloqueie. O limite de 500 MB é um teto para começar; o painel da Vercel mostra
  o consumo do store.
