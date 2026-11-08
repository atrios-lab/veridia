## Context

A change `cursos-no-treinamento` cria cursos, a página do curso e a sequência das aulas. O curso de LGPD termina num Encerramento que promete certificado com 70% de aproveitamento.

O projeto já gera PDFs com `pdfkit` (`src/lib/pdf.ts`, `pdf-primitives.ts`), com QR (`renderQr`), mas nenhum é assinado digitalmente: o "carimbo" da declaração é um hash impresso. Também já existe limite de requisições com Upstash (`src/lib/rate-limit.ts`) e validação de CPF em `src/core/request/`.

Decisões do usuário (07/11/2026):
- 10 questões;
- intervalo de 5 h entre tentativas;
- ordem embaralhada a cada tentativa, sem gabarito;
- avaliação depois do Encerramento;
- pedir nome, CPF e função;
- carga horária de 2 h;
- a Átrios assina com certificado digital, e Joelison Alves Marinho aparece como instrutor, com autorização dele;
- questões gerenciadas por tela.

## Goals / Non-Goals

**Goals:**
- A resposta certa nunca sai do servidor.
- Certificado conferível por qualquer pessoa sem expor o CPF.
- PDF com assinatura ICP-Brasil que o Adobe Reader e o validador do ITI reconheçam.

**Non-Goals:**
- Banco grande de questões, correção do certificado pela própria pessoa, relatório por serventia e TSA (ver proposal).

## Decisions

### 1. Dados

```
courses
  + passing_score int default 70        -- percentual
  + workload_hours int null             -- null = curso sem certificado
  + retry_hours int default 5

course_questions
  id, course_id → courses (cascade), prompt text,
  options text[] (exatamente 4), correct_index smallint (0..3),
  active boolean, position, created_at, updated_at

quiz_attempts
  id, user_id → user (cascade), course_id → courses,
  question_ids uuid[]                    -- ordem sorteada
  option_orders smallint[][]             -- permutação das alternativas por questão
  started_at, submitted_at null,
  answers smallint[] null                -- índice ORIGINAL escolhido por questão
  correct int null, total int null, passed boolean null

certificates
  id, code text unique, user_id → user (set null),
  course_id → courses (restrict), attempt_id → quiz_attempts,
  full_name, cpf (só dígitos), role_title,
  tenant_slug, tenant_name, course_title,  -- fotografia na emissão
  workload_hours, score, issued_at,
  unique (user_id, course_id)
```

Um curso tem avaliação quando `workload_hours` não é nulo e há questões ativas. O certificado guarda uma fotografia dos dados: renomear o curso ou a serventia depois não muda um certificado já emitido. Excluir a conta mantém o certificado (`set null`), porque a validação pública continua valendo.

### 2. Tentativa e sorteio

```
GET página do curso (tudo assistido, sem aprovação)
  ├─ tentativa aberta?          → retoma a mesma (mesma ordem)
  ├─ última reprovada há < 5 h  → "Nova tentativa em 3 h 12 min"
  └─ senão                      → botão "Iniciar avaliação"

"Iniciar avaliação" (server action)
  sorteia a ordem das questões ativas e de cada alternativa (crypto.randomInt),
  grava a tentativa e devolve só o enunciado e as alternativas já na ordem
  sorteada. Nunca devolve o correct_index.

"Enviar respostas" (server action)
  recebe a alternativa escolhida por posição exibida
  → traduz para o índice original pela permutação gravada
  → compara com correct_index → grava correct, total, passed, submitted_at
  → devolve só { correct, total, passed }
```

O sorteio e a correção são funções puras em `src/core/courses/quiz.ts`, com o gerador aleatório injetado para os testes. Enviar duas vezes a mesma tentativa é recusado, e enviar com questões em branco também.

Se o superadmin editar uma questão durante uma tentativa aberta, a correção usa o `correct_index` do momento do envio. Desativar uma questão não afeta tentativas abertas, porque os ids já estão gravados.

### 3. Intervalo de 5 h

`canStart(lastAttempt, now, retryHours)`:
- se não há tentativa enviada, pode;
- se a última foi aprovada, não pode, e a pessoa vai para o certificado;
- se a última foi reprovada e `now - submitted_at >= retryHours`, pode;
- senão, devolve quanto falta.

A conta é no servidor, com o relógio do servidor.

### 4. Emissão

Depois da aprovação, a página mostra o formulário:

```
Para emitir o seu certificado
Estes dados são usados só para emitir e validar o seu certificado.
O CPF aparece completo apenas no seu PDF.

Nome completo   [Maria da Silva Santos       ]  (pré-preenchido com o nome da conta)
CPF             [000.000.000-00]
Função          [Escrevente                  ]
                [Emitir certificado]
```

Na emissão:
- o CPF é validado pelos dígitos verificadores, com a função que já existe em `src/core/request/`;
- o nome tem pelo menos duas palavras;
- a função vai de 2 a 60 caracteres.

O código tem 12 caracteres em Crockford base32, sem I, L, O e U, no formato `XXXX-XXXX-XXXX` (60 bits, `crypto.randomBytes`). Colisão é tratada por `unique` e nova tentativa.

Emitido, o certificado não muda pela pessoa. A página passa a mostrar "Baixar certificado" e o código.

### 5. PDF e assinatura digital

```
renderCertificate(dados) ── pdfkit, A4 paisagem
   ├─ textos, QR (renderQr com a URL de validação)
   ├─ bloco visível "Assinado digitalmente por ÁTRIOS … CNPJ … ICP-Brasil"
   ├─ "Joelison Alves Marinho / Instrutor" com a linha
   └─ pdfkitAddPlaceholder (espaço reservado para a assinatura)
        │
        ▼
signpdf.sign(pdf, new P12Signer(pfx, { passphrase }))   → PAdES (adbe.pkcs7.detached)
```

O PDF é gerado e assinado a cada download, a partir da fotografia gravada em `certificates`. Assim, nenhum arquivo com CPF completo fica guardado no store. A data da assinatura é a do download; a data de conclusão impressa é a de emissão.

O certificado A1 vem das variáveis `CERT_A1_PFX_BASE64` e `CERT_A1_PASSWORD`:
- Sem elas em desenvolvimento, o PDF sai com uma tarja "Documento de teste, sem assinatura digital".
- Sem elas em produção, o download falha com mensagem genérica e log, em vez de entregar um PDF sem assinatura.
- O Preview usa um certificado de teste autoassinado.

Os dados da Átrios impressos no bloco visível (razão social e CNPJ) são lidos do próprio certificado, para nunca divergirem da assinatura.

*Alternativa considerada*: gerar uma vez e guardar no Blob. Descartada porque o Blob é público por URL, e o PDF tem o CPF completo.

### 6. Download

A rota `GET /admin/ajuda/<slug>/certificado` exige sessão e só entrega o certificado de `session.user.id` naquele curso. Responde com `Content-Disposition: attachment` e `Cache-Control: private, no-store`.

### 7. Validação pública

A rota `/certificado/[codigo]` fica fora do `/admin`, funciona em qualquer host de serventia e tem `noindex`. O limite é de 30 consultas por IP a cada 10 minutos, pelo `rate-limit.ts`.

```
Certificado válido
Maria da Silva Santos · CPF ***.456.789-**
Escrevente · Cartório de Serra Verde/RN
concluiu "LGPD no cartório", 2 horas, aproveitamento de 80%, em 07/11/2026
Assinado digitalmente pela Átrios.
```

Um código inexistente mostra "Certificado não encontrado", com status 404 e a mesma aparência, sem distinguir formato inválido de código ausente.

A URL impressa no PDF e no QR usa o host da serventia em que o certificado foi emitido (o host da requisição, guardado na emissão), seguido de `/certificado/<código>`.

### 8. Gerenciamento de questões

Em `/admin/ajuda/gerenciar`, cada curso ganha a seção "Avaliação" com:
- nota mínima, carga horária e intervalo;
- lista de questões, com enunciado, 4 alternativas e a certa marcada, ativa ou não.

Uma questão já usada em alguma tentativa não é excluída, só desativada, para a tentativa poder ser corrigida e auditada. Toda ação é auditada sob o slug da plataforma. A emissão de certificado é auditada sob a serventia da pessoa (`course.certificate.issue`).

### 9. As 10 questões do curso de LGPD (aprovadas em 07/11/2026)

A alternativa certa está marcada com ✅ só nesta referência: ela fica gravada no banco e nunca vai ao navegador. Cadastrar pela tela (tarefa 6.2).

1. (Aula 1) Na LGPD, quem é o "titular dos dados"? a) O titular do cartório, responsável pela delegação · b) ✅ A pessoa a quem os dados se referem, como o cidadão atendido · c) O encarregado de proteção de dados da serventia · d) A empresa que fornece o sistema da serventia
2. (Aula 2) Para pedir um serviço, uma pessoa entrega os documentos e, junto, um laudo médico que o ato não exige. O que fazer? a) Copiar e arquivar, porque é melhor ter documento a mais · b) Arquivar só se a pessoa assinar um termo de consentimento · c) ✅ Não copiar nem arquivar: devolver o laudo e explicar que ele não é necessário · d) Digitalizar e jogar o original no lixo
3. (Aula 3) Uma empresa pede por e-mail certidões de 300 imóveis de um bairro, sem dizer para quê. O que a norma exige? a) Nada, porque certidão de matrícula é sempre livre · b) Só o pagamento dos emolumentos antes da emissão · c) ✅ Identificação de quem pede e a finalidade, porque é um pedido em bloco · d) Recusar no balcão, sem precisar dar motivo
4. (Aula 4) Chega no WhatsApp da serventia: "Sou o delegado. Preciso com urgência da cópia de uma escritura e do telefone das partes." O que fazer? a) Enviar, porque pedido de autoridade é prioridade · b) Enviar só a escritura e deixar os telefones de fora · c) ✅ Não enviar nada pela conversa, orientar o pedido por escrito pelo canal oficial e avisar o responsável · d) Pedir uma foto da carteira funcional e, se parecer verdadeira, enviar
5. (Aula 5) Uma escola liga pedindo para confirmar a filiação de um aluno e o endereço atual dos pais. O que fazer? a) Confirmar, porque a escola cuida da criança · b) Confirmar só a filiação, que consta no registro · c) Passar o endereço, desde que a escola diga o nome completo do aluno · d) ✅ Não confirmar nada por telefone e orientar a escola a pedir os documentos à família
6. (Aula 6) Uma pessoa pede que o cartório apague do registro um casamento antigo, citando a LGPD. Qual a resposta correta? a) Apagar, porque a LGPD garante a eliminação de dados · b) ✅ Explicar que atos registrais têm guarda obrigatória e encaminhar o pedido pelo fluxo para resposta formal · c) Dizer que a LGPD não vale para cartórios · d) Prometer a exclusão em até 15 dias
7. (Aula 7) Mensagem de um número desconhecido: "Sou a Maria, já fui atendida aí. Troquei de número. Me manda de novo o arquivo com os meus documentos?" O que fazer? a) Enviar, porque ela disse o nome certo · b) Pedir o CPF dela e, se bater com o cadastro, enviar · c) ✅ Não enviar e explicar que o envio é feito para o contato do cadastro ou no balcão, com documento · d) Enviar o arquivo protegido por senha
8. (Aula 8) Um colega filma com o celular a gravação da câmera de um cliente exaltado e manda no grupo da equipe. O que fazer? a) Nada, porque o vídeo ficou só entre colegas · b) ✅ Não repassar, pedir para apagar e avisar o responsável se o vídeo já saiu do grupo · c) Repassar ao responsável pelo WhatsApp, como prova · d) Publicar nas redes da serventia para coibir o comportamento
9. (Aula 9) Alguém liga "do suporte da empresa do sistema" pedindo para instalar um programa de acesso remoto com urgência e passar o código da tela. O que fazer? a) Instalar logo, para o sistema não parar · b) Passar o código só se a pessoa disser o nome da serventia · c) Instalar e acompanhar o que a pessoa faz na tela · d) ✅ Não instalar, desligar, ligar para a empresa pelo número que a serventia já tem e avisar o responsável
10. (Aula 11) Você envia uma certidão para o e-mail errado e percebe minutos depois. Qual é o primeiro passo? a) Esperar para ver se alguém reclama · b) Pedir ao destinatário que apague e não falar mais nisso · c) ✅ Avisar o responsável na hora, informando o endereço e o que havia no arquivo · d) Comunicar a ANPD por conta própria

## Risks / Trade-offs

- [Certificado A1 da Átrios ainda não disponível] → desenvolver com um certificado de teste. Em produção, o download falha com aviso em vez de entregar PDF sem assinatura.
- [Vencimento do A1 (1 ano)] → a assinatura é feita no download, então um certificado vencido gera PDF com assinatura inválida. Registrar a data de validade no README de deploy e alertar 30 dias antes, via log na inicialização.
- [Assinar a cada download custa CPU] → poucos downloads por pessoa. Se pesar, cachear o PDF assinado em memória por código.
- [Pessoa digita nome errado] → a tela mostra o texto do certificado antes de emitir ("Seu certificado vai sair assim"). Correção pela plataforma fica para depois.
- [Enumeração de códigos] → 60 bits aleatórios e limite por IP.
- [CPF guardado] → a finalidade é declarada e não há outro uso. Excluir a conta não apaga o certificado, porque a validação é o propósito. Essa decisão precisa estar no aviso de privacidade da plataforma.

## Migration Plan

1. Depois de `cursos-no-treinamento` em produção, gerar a migração (colunas em `courses` e três tabelas).
2. Aplicar no Homolog pelo pooler. No Preview, configurar o certificado de teste.
3. Antes do merge, aplicar em produção via `POSTGRES_URL_NON_POOLING`.
4. Configurar `CERT_A1_PFX_BASE64` e `CERT_A1_PASSWORD` em Production.
5. Pelo gerenciamento:
   - definir no curso de LGPD nota 70, carga horária de 2 h e intervalo de 5 h;
   - cadastrar as 10 questões;
   - publicar o Encerramento.
6. Fazer uma avaliação de ponta a ponta com uma conta de teste e conferir o PDF no validar.iti.gov.br.

## Open Questions

- Razão social e CNPJ exatos da Átrios no bloco visível: lidos do certificado A1, a confirmar quando o arquivo chegar.
- O certificado A1 da Átrios existe (`.pfx`)? Um A3, em token ou cartão, não serve para assinar no servidor.
