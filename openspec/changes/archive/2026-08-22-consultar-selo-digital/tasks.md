# Tasks — Consultar Selo Digital

## 1. Núcleo e cliente do SIEX

- [x] 1.1 Criar `src/core/seal/parse.ts` com `parseSealLookup(html)` retornando `{ kind: "message", text } | { kind: "seals", ... } | { kind: "unrecognized" }`; extrair `div.mensagemDaPagina`; markup desconhecido vira `unrecognized`, nunca exceção
- [x] 1.2 Testes do parser (`node --test`) contra fixture da página de erro já capturada no recon (captcha errado) e contra HTML arbitrário (→ `unrecognized`)
- [x] 1.3 Criar `src/lib/tj-seal.ts` com `openSession()`, `fetchCaptcha(sessionId)` e `submitLookup(sessionId, codes, captcha)`: timeout ~10s, decodificação `iso-8859-1`, campos hidden do formulário fixos, UA default, sem retry; `fetchCaptcha` OBRIGATORIAMENTE com query string única (`jcaptcha.jpg?ts=...`) — a Akamai cacheia a imagem e sem o buster o captcha "sempre erra" (validado em campo)

## 2. Fixture real do SIEX

- [x] 2.1 Criar `scripts/capture-seal-fixture.ts` (ferramenta de recaptura para quando o TJ mudar o markup): abre sessão, salva o PNG do captcha **com cache-buster na URL**, pede no terminal o texto do captcha e um código de selo real, submete e grava a resposta
- [x] 2.2 Copiar as fixtures já capturadas em `openspec/changes/consultar-selo-digital/recon/` (sucesso anonimizado + captcha errado) para `src/lib/fixtures/` (não `src/core`: ler arquivo é I/O, que o núcleo puro não faz — regra do Biome)
- [x] 2.3 Implementar o parse de sucesso (`kind: "seals"`) a partir da fixture — blob `<br>`-separado em `div.conteudoSemRotulo`, seções em `<b>`, valores monetários repassados como string (o TJ mistura "0,05" e "4.21") — e cobrir com teste

## 3. Rotas e página

- [x] 3.1 Route handler `GET /selo/captcha`: abre sessão nova no TJ, seta cookie HttpOnly `tj-seal-session` (secure, path `/selo`, maxAge ~10 min), responde o PNG com `Cache-Control: no-store`
- [x] 3.2 Server action da consulta: valida entrada, lê o cookie (ausente → orientação de gerar novo código), chama `submitLookup`, devolve resultado tipado do parser
- [x] 3.3 Reescrever `src/app/(public)/selo/page.tsx`: sai o `ComingSoon`; form client com campo do código, imagem do captcha, "gerar novo código" (recarrega a rota com cache-buster), botão consultar; preservar o código digitado quando o captcha erra
- [x] 3.4 Renderizar resultados: cards no design system do tenant para `seals`, mensagem clara para `message`, card de indisponibilidade com link oficial para `unrecognized`/falha de rede
- [x] 3.5 Aviso fixo de conferência simples junto ao resultado + link permanente para a consulta oficial do TJ no corpo da página

## 4. Proteção e acabamento

- [x] 4.1 Novo limiter `veridia:seal` (~10/min por IP) em `rate-limit.ts`, aplicado na rota do captcha e na action; resposta de limite orienta aguardar
- [x] 4.2 Teste e2e Playwright do caminho de erro (captcha errado → mensagem clara → gerar novo código) com o TJ real ou mock local, conforme viabilidade em CI
- [x] 4.3 Conferir gating (`requireSection("selo-tjrn")`), tema nos cinco temas, dark/light, mobile 390px
- [x] 4.4 `pnpm check` (Biome + tsc) e revisão do texto da UI em português
