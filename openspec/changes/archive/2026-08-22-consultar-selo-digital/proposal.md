# Proposta — Consultar Selo Digital

## Why

`/selo` é a última seção pública do site em estado "em breve": o card da home promete "Verificar selo digital" e a página entrega um placeholder. A consulta oficial existe no SIEX do TJRN (`selodigital.tjrn.jus.br`), mas é uma tela de 2010 (iso-8859-1, recomenda IE7) que quebra a promessa da plataforma de resolver tudo no site da serventia. O recon de 2026-08-22 validou que a consulta é reproduzível por HTTP puro — sessão `JSESSIONID`, captcha por sessão, POST de formulário clássico — o que permite re-embalá-la na identidade da serventia sem burlar nada: o captcha do TJ é exibido ao cidadão e resolvido por ele, nunca por máquina.

## What Changes

- `/selo` deixa de ser `ComingSoon` e vira a consulta real: campo de código do selo, imagem do captcha do TJ, resultado renderizado na identidade da serventia.
- Nasce um cliente do SIEX no servidor (abrir sessão, baixar captcha, submeter consulta, parsear resposta iso-8859-1), com a regra de parse em núcleo puro (`src/core`) e o I/O em `src/lib`.
- Sessão TJ↔cidadão mapeada por token opaco com TTL curto no Upstash Redis (dependência já existente).
- Rate limit na rota (padrão `rate-limit.ts` existente).
- Fallback permanente: link para a consulta oficial do TJ sempre visível na página, e card de indisponibilidade quando o TJ não responder ou o parse falhar.
- Script de captura manual de fixtures (o HTML de sucesso só se obtém com selo real + captcha resolvido por humano); o parser nasce dos fixtures capturados.

## Capabilities

### New Capabilities

- `digital-seal-lookup`: consulta pública do selo digital do TJRN dentro do site da serventia — captcha do TJ repassado ao cidadão, submissão via proxy de sessão, resultado na identidade do tenant, fallback para a consulta oficial.

### Modified Capabilities

Nenhuma: `public-home` já descreve o card "Verificar selo digital" e o gating `selo-tjrn` já existe; nenhum requisito existente muda.

## Non-goals (Não-objetivos)

- **Resolver ou burlar o captcha por máquina** (OCR, serviço de terceiros, cache de respostas): o captcha é do TJ e é sempre o cidadão quem o resolve. Isso é princípio, não limitação.
- Webservice/convênio oficial com o TJRN: se um endpoint conveniado surgir, substitui este proxy em change própria.
- Consulta de selos de outros tribunais (TJPB, TJCE etc.): o cliente é do SIEX/TJRN; outro tribunal é outra change.
- Histórico ou persistência de consultas: nada é gravado em banco; a consulta é efêmera por natureza.
- Validação local do formato do código do selo além do trivial (o TJ é a autoridade; nós repassamos).

## Impact

- **Código novo**: `src/core/seal/` (parse puro do HTML do SIEX), `src/lib/tj-seal.ts` (I/O: sessão, captcha, submit), rota/route handlers sob `src/app/(public)/selo/`, fixtures de teste.
- **Código alterado**: `src/app/(public)/selo/page.tsx` (sai o `ComingSoon`).
- **Dependências**: nenhuma nova — `@upstash/redis` e `rate-limit.ts` já existem. Sem browser headless: HTTP puro.
- **Sistemas externos**: SIEX do TJRN atrás de Akamai. Risco assumido: mudança de markup ou bloqueio de IP de datacenter quebra a consulta — mitigado pelo fallback sempre presente e por erro honesto na UI.
- **Banco**: nenhuma migração.
