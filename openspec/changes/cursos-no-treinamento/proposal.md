## Why

O Treinamento hoje é uma lista única de vídeos sobre o painel. O curso de LGPD está pronto para publicar: Apresentação, 12 aulas, Encerramento e uma apostila. Ele não cabe nessa lista. As aulas têm ordem, uma depende da anterior, e o curso termina numa avaliação com certificado (change `avaliacao-e-certificado`). Outros cursos virão, então quem assiste precisa ver cada curso separado, saber onde parou e não se perder entre um e outro.

## What Changes

- **Cursos.** Uma nova tabela `courses`. Todo vídeo passa a pertencer a um curso e a ter um tipo: Apresentação, Aula ou Encerramento. Só as Aulas recebem número (Aula 1, Aula 2…), pela ordem dentro do curso.
- **Catálogo em `/admin/ajuda`.** O topo traz um destaque "Continue de onde parou", com a próxima aula disponível de qualquer curso. Abaixo vêm os cursos publicados em cards com capa, número de aulas, duração total e andamento ("3 de 14").
- **Página do curso em `/admin/ajuda/<slug>`.**
  - Curso sequencial (LGPD): player e lista numerada das aulas, com cadeado nas que ainda não abriram, botão "Próxima aula" e link para a apostila.
  - Curso de consulta ("Uso do painel"): mantém a vitrine de hoje, com destaque e prateleiras.
- **Sequência.** Num curso sequencial, cada item abre só depois que o anterior foi assistido. Quando a pessoa assiste a tudo, tudo fica aberto para rever. O servidor recusa marcar como assistido um item que ainda está fechado.
- **Assistido de verdade nas aulas.** Em curso sequencial, o vídeo só conta como assistido quando chega ao fim. Não há botão "Marcar como assistido", e o player não deixa adiantar além do ponto já assistido. Voltar é livre.
- **Apostila.** Cada curso pode ter um PDF de material de apoio, para baixar na página do curso.
- **"Uso do painel".** Os 7 vídeos atuais viram um curso de consulta. A trilha de primeiros passos, o card da Visão geral e o link "Como usar esta tela" continuam olhando só para ele.
- **Links antigos.** `/admin/ajuda?video=<id>` (do "Como usar esta tela" e de links já compartilhados) redireciona para a página do curso do vídeo.
- **Gerenciamento.** Em `/admin/ajuda/gerenciar`, o superadmin passa a criar e editar cursos: título, slug, descrição, capa, apostila, se é sequencial, ordem e publicação. O formulário de vídeo ganha os campos "curso" e "tipo".
- **Publicação do curso de LGPD.** É cadastrado com Apresentação, Aulas 1 a 12 e a apostila. O Encerramento fica em rascunho até a change `avaliacao-e-certificado` entrar, porque fala do certificado.

## Non-goals

- Avaliação, certificado e validação pública: change `avaliacao-e-certificado`.
- Obrigar a pessoa a fazer um curso, prazo para concluir ou relatório de quem concluiu por serventia.
- Bloquear a aceleração do vídeo ou detectar aba em segundo plano. O bloqueio de adiantar é uma barreira no navegador, não uma prova.
- Curso restrito a um papel ou a uma serventia. Todo usuário do painel vê todos os cursos publicados.
- Busca e filtros no catálogo.

## Capabilities

### New Capabilities

- `admin-courses`: cursos da plataforma, com catálogo, página do curso, sequência de aulas, apostila e gerenciamento de cursos.

### Modified Capabilities

- `admin-tutorials`:
  - o catálogo de vídeos passa a ter curso, tipo e posição no curso;
  - `/admin/ajuda` vira o catálogo de cursos, e a vitrine passa a ser a página dos cursos de consulta;
  - `?video=` redireciona para a página do curso;
  - a trilha de primeiros passos fica restrita ao curso "Uso do painel";
  - "Marcar como assistido" deixa de existir nas aulas de curso sequencial.
- `admin-tutorials-management`: o formulário de vídeo ganha curso e tipo; publicar ou excluir um curso afeta os vídeos dele.

## Impact

- **Banco**:
  - nova tabela `courses`;
  - `tutorials` ganha `course_id` (obrigatório depois da migração), `kind` e passa a ter a posição contada dentro do curso;
  - a migração cria o curso "Uso do painel" e liga os 7 vídeos a ele.

  A migração de produção é manual, via `POSTGRES_URL_NON_POOLING`, e precisa rodar antes do merge.
- **Ordem**: a change `treinamento-em-vitrine` precisa ser arquivada antes, porque os deltas daqui partem do texto dela.
- **Código**:
  - `src/app/admin/(dashboard)/ajuda/` (catálogo, nova rota `[curso]`, gerenciamento);
  - `src/core/tutorials/` (progresso por curso, regra de sequência);
  - `src/lib/tutorials.ts` e um novo `src/lib/courses.ts`;
  - o card da trilha na Visão geral;
  - o link do cabeçalho de página.
- **Arquivos**: apostila em PDF no Blob, sob `treinamento/`. Capa e apostila do curso usam a rota de token que já existe, com um tipo novo (`application/pdf`).
- **Conteúdo**: os 14 vídeos e a apostila do LGPD vêm de `~/curso-lgpd-cartorios/out/`, e as legendas estão gravadas no próprio vídeo, sem `.vtt`. A capa do curso e as das aulas seguem o modelo das capas do Treinamento.
