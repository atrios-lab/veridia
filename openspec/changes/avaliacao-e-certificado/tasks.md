## 1. Antes de começar

- [ ] 1.1 Confirmar que `cursos-no-treinamento` está em produção
- [ ] 1.2 Confirmar com a Átrios o certificado A1 (`.pfx`) e a senha; enquanto não chega, gerar um certificado de teste autoassinado para desenvolvimento e Preview

## 2. Dados e regras puras

- [x] 2.1 Colunas `passing_score`, `workload_hours` e `retry_hours` em `courses`; tabelas `course_questions`, `quiz_attempts` e `certificates`; migração Drizzle conferida
- [x] 2.2 `src/core/courses/quiz.ts`: sorteio de questões e alternativas com gerador injetado, tradução da posição exibida para o índice original, correção, aprovação pela nota mínima, `canStart` com intervalo; testes em `node --test`
- [x] 2.3 `src/core/courses/certificate.ts`: código Crockford base32 de 12 caracteres, máscara de CPF, validação de nome e função (reaproveitando a validação de CPF que já existe), texto do certificado; testes

## 3. Leitura e escrita

- [x] 3.1 `src/lib/quiz.ts`: iniciar ou retomar a tentativa (sem `correct_index` no retorno), enviar (recusa reenvio e resposta em branco), estado da avaliação para a página; testes contra PGlite
- [x] 3.2 `src/lib/certificates.ts`: emitir (só aprovado, um por pessoa e curso, com fotografia dos dados), buscar por código, buscar o da sessão; auditoria sob a serventia; testes contra PGlite
- [x] 3.3 Questões e configuração de avaliação: criar, editar, ativar e desativar, recusando excluir questão usada; auditoria sob a plataforma; testes contra PGlite

## 4. PDF assinado

- [x] 4.1 Adicionar `@signpdf/signpdf`, `@signpdf/signer-p12` e `@signpdf/placeholder-plain` (o `placeholder-pdfkit` não aceita o pdfkit 0.19)
- [x] 4.2 Copiar `materiais-curso/assinatura-joelison.png` (recortada em 07/11/2026) para `src/lib/assets/`, fora de `public/`
- [x] 4.2.1 `renderCertificate` em pdfkit (A4 paisagem): textos, QR de validação, bloco visível da assinatura com razão social e CNPJ lidos do A1, nome de Joelison Alves Marinho como instrutor
- [x] 4.3 Assinatura PAdES com `CERT_A1_PFX_BASE64` e `CERT_A1_PASSWORD`: tarja de teste fora de produção sem certificado; falha com log em produção sem certificado; teste que confere a presença e a integridade da assinatura com o certificado de teste

## 5. Telas e rotas

- [x] 5.1 Página do curso: bloco "Avaliação" com os estados fechada (quantos faltam), disponível, em andamento, aguardando intervalo (quanto falta), aprovada e certificado emitido
- [x] 5.2 Tela da tentativa: questões na ordem sorteada, envio, resultado só com acertos e situação
- [x] 5.3 Formulário de emissão com aviso de finalidade, prévia do texto e confirmação
- [x] 5.4 Rota `GET /admin/ajuda/[curso]/certificado`: só o dono, `attachment`, `private, no-store`
- [x] 5.5 Consulta pública `GET /api/certificados/[codigo]` para o site da Átrios: visão com CPF mascarado, 404 igual para inexistente e malformado, `noindex`, CORS só para atrioss.com, limite de 30 consultas por IP a cada 10 minutos, token para o servidor da Átrios; endereço impresso `https://atrioss.com/certificado/<código>`
- [x] 5.6 Gerenciamento: seção "Avaliação" por curso (nota, carga horária, intervalo, questões)

## 6. Conferência e produção

- [x] 6.1 Rodar os testes tocados, `pnpm typecheck` e `pnpm lint`
- [x] 6.2 Aplicar a migração no Homolog pelo pooler; conferir no navegador (local, contra o Homolog, curso de teste já apagado) uma tentativa reprovada, uma aprovada, CPF inválido recusado, emissão, download e validação pública (as 10 questões do design entram na 6.4; o gerenciamento não foi conferido no navegador porque o seed local é `staff`)
- [ ] 6.3 Antes do merge, aplicar a migração em produção via `POSTGRES_URL_NON_POOLING` e configurar o A1 em Production
- [ ] 6.3.1 Configurar `CERTIFICATE_API_TOKEN` em Production e passar o mesmo valor ao site da Átrios
- [ ] 6.3.2 No site da Átrios: página `/certificado/[codigo]` consultando `https://<host do Veridia>/api/certificados/<código>`
- [ ] 6.4 Em produção: configurar o curso de LGPD (70%, 2 h, 5 h), cadastrar as 10 questões, publicar o Encerramento, emitir um certificado de teste e conferir a assinatura em validar.iti.gov.br
