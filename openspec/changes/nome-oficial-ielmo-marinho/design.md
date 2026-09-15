## Context

O tenant `cartorio-marinho` é a serventia piloto em produção. Seu nome de exibição,
"Cartório Marinho", é um nome fantasia, e um provimento da Corregedoria do RN passou a vedar
o uso de nome que não seja o da serventia. A serventia pediu a troca no site e nos
requerimentos.

O nome vem de um único ponto de verdade, `name` em `src/core/tenant/tenants/marinho.ts`, e
é lido por cerca de trinta pontos: cabeçalho, menu mobile e rodapé do site
(`src/app/(public)/layout.tsx`), `<title>` e template de título (`src/app/layout.tsx`),
cabeçalho e rodapé dos três PDFs (`src/core/request/requerimento.ts`,
`src/core/request/declaracao.ts`), remetente e corpo dos e-mails (`src/lib/email/*`), ICS
do agendamento, boletim de transparência, sidebar/login/configurações do painel e o QR do
Pix. Nenhum desses leitores tem a string embutida.

Fora desse ponto, o nome antigo aparece em: o texto `about` do mesmo arquivo ("O Cartório
Marinho é o Ofício Único de..."), o texto de ajuda do campo `tradeName` em
`src/core/compliance/sections.ts` (que usa "Cartório Marinho" como exemplo de nome
fantasia), três testes e três linhas do README.

Os quatro PNGs em `public/logos/CM-*.png` trazem "CARTÓRIO MARINHO" gravado na imagem; o
selo redondo vai para o cabeçalho de todo PDF, para o favicon e para o header do site e do
painel. O painel já permite à serventia substituir logos e selo pela Identidade Visual, com
override em banco.

## Goals / Non-Goals

**Goals:**
- Nenhum texto gerado pelo código do tenant piloto chama a serventia de "Cartório Marinho".
- A troca acontece no valor configurado, sem tocar em leitores nem em schema.
- O módulo de Adequação deixa de usar uma serventia real como exemplo de nome fantasia.

**Non-Goals:**
- Substituir os arquivos de logo: a serventia envia a arte nova pelo painel.
- Ajustar `home.title` (hero): editável pelo painel, decisão da serventia.
- Revisar o nome dos outros sete tenants ("Cartório de X" já identifica a serventia pelo
  município; se o provimento exigir a denominação oficial, é outra change).
- Tornar `subtitle` opcional ou redefinir o par `name`/`subtitle`.

## Decisions

**Nome "Cartório Ielmo Marinho/RN", subtítulo mantido.** A serventia primeiro escreveu
"Cartório do Ofício Único de Ielmo Marinho/RN"; o usuário fechou em "Cartório Ielmo
Marinho/RN" com o subtítulo continuando a denominação oficial. A alternativa de usar a
denominação oficial como `name` deixaria as duas linhas redundantes em todo lugar em que o
par aparece junto (header, rodapé, PDF, `<title>` + description) e obrigaria a tornar
`subtitle` opcional em ~20 leitores. Com o município no nome e a denominação oficial no
subtítulo, o par continua informativo e o schema não muda.

**Caixa normal, barra sem espaços.** A serventia escreveu em maiúsculas; o `name` não passa
por `uppercase` no CSS (só o subtítulo passa) e vai literal para `<title>`, remetente do
e-mail e rodapé do PDF, onde caixa alta leria como grito. Os outros tenants usam caixa normal.
A barra sem espaços segue a grafia da serventia; o subtítulo mantém "Ielmo Marinho / RN" com
espaços porque já era assim e não foi pedido mudar. Se a serventia quiser maiúsculas, é uma
string.

**Texto `about` reescrito sem nome fantasia.** Passa a abrir pela denominação oficial ("O
Ofício Único de Ielmo Marinho / RN reúne todos os serviços de registro e notas do
município..."), mantendo o restante do parágrafo.

**Exemplo fictício no help de `tradeName`.** Trocar "ex.: Cartório Marinho" por um exemplo
que nenhuma serventia cadastrada usa (ex.: "Cartório da Praça"). O help do campo
`officialName` já usa "Ofício Único de Bom Jesus", que é denominação oficial e fica.

**Testes: fixture literal segue o nome novo.** `invite.test.ts` e `channels.test.ts` usam a
string como fixture (não leem a config); `declaracao.test.ts` lê `cartorioMarinho` e casa
`/Serventia: Cartório Marinho/`. Os três passam a usar o nome novo, para que um grep por
"Cartório Marinho" no repositório volte vazio fora do histórico do OpenSpec.

**Sem varredura nos leitores.** Não se altera nenhum arquivo que só lê `tenant.name`; a
verificação é rodar os testes tocados e conferir visualmente o header e um PDF no host
`marinho.localhost`.

## Risks / Trade-offs

- [Selo com "CARTÓRIO MARINHO" continua nos PDFs e no header até a serventia subir a arte
  nova] → Já combinado com a serventia; o texto ao lado do selo passa a ser o nome novo desde
  o deploy, e a Identidade Visual substitui a imagem sem novo deploy.
- [Hero da home repete o subtítulo logo abaixo do header] → Já era assim; `home.title` é
  editável pelo painel.
- [Overrides em banco carregariam o nome antigo] → Não carregam: `OfficeContactSchema`,
  `OfficeBrandSchema` e `OfficeDpoSchema` são `pick` que excluem `name`. Nada a migrar.
- [E-mails já enviados e PDFs já baixados citam o nome antigo] → Documentos gerados no
  passado não se reescrevem; os PDFs de requerimento são gerados sob demanda, então um novo
  download já sai com o nome novo.

## Migration Plan

Deploy comum via branch e PR; sem migração de banco. Rollback é reverter o commit.

## Open Questions

- Qual é o provimento (número e artigo)? Define se "Cartório de X" dos outros tenants também
  cai. Pendente com a serventia; não bloqueia esta change.
