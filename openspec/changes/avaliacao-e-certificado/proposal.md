## Why

O curso de LGPD termina prometendo um certificado com aproveitamento mínimo de 70%. A serventia precisa guardar o comprovante de que a equipe fez o treinamento: a Aula 11 diz isso com todas as letras. Sem uma avaliação e um certificado conferível, o curso fica sem fechamento e a promessa do Encerramento fica sem cumprir.

## What Changes

- **Avaliação por curso.** Abre quando a pessoa assistiu a todos os vídeos publicados do curso, inclusive o Encerramento. As 10 questões de múltipla escolha aparecem numa ordem sorteada a cada tentativa, assim como as alternativas de cada questão. O sorteio fica guardado na tentativa: recarregar a página não muda nada.
- **Sem gabarito.** O navegador nunca recebe a resposta certa. A correção é no servidor, e o resultado mostra só quantas a pessoa acertou e se foi aprovada. Não diz quais errou nem quais eram as certas.
- **Nota mínima e intervalo.** Com 70% ou mais, a pessoa está aprovada. Com menos, só pode tentar de novo 5 horas depois do envio. Aprovada, não faz outra tentativa.
- **Emissão do certificado.** Depois da aprovação, a pessoa informa o nome completo, o CPF (com dígitos conferidos) e a função, vendo antes para que esses dados servem. É emitido um certificado por pessoa e por curso, com um código de validação.
- **PDF assinado digitalmente.** O certificado traz:
  - nome, CPF, função, serventia, curso, carga horária (2 h), aproveitamento, data, código e QR de validação;
  - a assinatura digital da Átrios com certificado A1 ICP-Brasil (PAdES);
  - o nome de Joelison Alves Marinho como instrutor.
- **Validação pública no site da Átrios.** O PDF e o QR apontam para `https://atrioss.com/certificado/<código>`. O site da Átrios monta a página a partir de `GET /api/certificados/<código>`, uma consulta pública que devolve só a visão do certificado, com o CPF mascarado. Ela libera chamadas vindas do navegador em atrioss.com, tem limite de consultas por IP e um token para o servidor da Átrios.
- **Gerenciamento.** Em `/admin/ajuda/gerenciar`, o superadmin cadastra, edita, ativa e desativa as questões de cada curso e define a nota mínima, a carga horária e o intervalo entre tentativas.
- **Curso de LGPD completo.** As 10 questões aprovadas são cadastradas (ver design), e o Encerramento do LGPD passa a ser publicado.

## Non-goals

- Banco de questões maior que o sorteio de 10, peso por questão ou questão dissertativa.
- Emitir de novo ou corrigir os dados de um certificado já emitido pela própria pessoa. Correção fica para uma change futura, feita pela plataforma.
- Relatório de certificados por serventia para o responsável.
- Assinatura digital do Joelison: o nome dele é impresso, e só a Átrios assina digitalmente.
- Carimbo de tempo de terceiro (TSA) na assinatura.

## Capabilities

### New Capabilities

- `course-certificates`: avaliação de curso, tentativas, emissão, PDF assinado, validação pública e gerenciamento de questões.

### Modified Capabilities

Nenhuma. A avaliação aparece na página do curso definida em `admin-courses` (change `cursos-no-treinamento`), sem mudar os requisitos de lá.

## Impact

- **Depende de**: `cursos-no-treinamento` aplicada antes.
- **Banco**:
  - colunas `passing_score`, `workload_hours` e `retry_hours` em `courses`;
  - tabelas `course_questions`, `quiz_attempts` e `certificates`.

  A migração de produção é manual e precisa rodar antes do merge.
- **Dependências novas**: `@signpdf/signpdf`, `@signpdf/signer-p12` e `@signpdf/placeholder-plain` (o `placeholder-pdfkit` só aceita pdfkit abaixo da 0.16), mais `node-forge` para ler o titular do A1.
- **Segredos**:
  - `CERT_A1_PFX_BASE64` e `CERT_A1_PASSWORD` nas variáveis da Vercel (Production; Preview com certificado de teste). Nunca no repositório.
  - `CERTIFICATE_API_TOKEN`, compartilhado com o servidor do site da Átrios.
  - `CERTIFICATE_CHECK_BASE_URL`, opcional, para trocar o endereço impresso fora de produção.
- **Dado pessoal**: o CPF é coletado só para o certificado e mostrado mascarado na validação pública. A finalidade aparece na tela de emissão.
- **Rotas novas**:
  - avaliação e emissão na página do curso;
  - download do certificado, só para a própria pessoa;
  - `/api/certificados/[codigo]`, pública, lida pelo site da Átrios.
