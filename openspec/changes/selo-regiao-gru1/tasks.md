## 1. Registro da falha com o TJ

- [x] 1.1 Criar em `src/core/seal/` uma função pura que monta o registro de falha (`step`, `status?`, `reason`, `region?`) a partir do status HTTP, da ausência de `JSESSIONID` ou do erro capturado (`TimeoutError` vira `"timeout"`)
- [x] 1.2 Testes `node --test` da função: 403 na sessão, 200 sem `JSESSIONID`, timeout no captcha, erro de rede no lookup; e um teste que garante que sessão, código do selo e captcha nunca aparecem no objeto, mesmo que estejam na mensagem do erro
- [x] 1.3 Em `src/lib/tj-seal.ts`, chamar a função e fazer `console.warn("[tj-seal]", ...)` nos caminhos de falha de `openSession`, `fetchCaptcha` e `fetchLookupHtml`, sem mudar o valor devolvido
- [x] 1.4 Conferir que `scripts/capture-seal-fixture.ts` continua rodando sob node puro (import relativo, nada de `@/`)

## 2. Região das funções do `/selo`

- [x] 2.1 `export const preferredRegion = "gru1"` em `src/app/(public)/selo/captcha/route.ts`
- [x] 2.2 `export const preferredRegion = "gru1"` em `src/app/(public)/selo/page.tsx` (cobre a server action `lookupSeal`)
- [x] 2.3 `pnpm build` local sem aviso de configuração de segmento; rodar só os testes tocados (`src/core/seal/*.test.ts`, `src/lib/seal-lookup.test.ts`)

## 3. Spike no Preview (Homolog)

- [ ] 3.1 Abrir o PR e aguardar o deploy de Preview
- [ ] 3.2 Chamar `/selo/captcha` no Preview pelo host de um tenant com `selo-tjrn` ligado; conferir `x-vercel-id` (função em `gru1`) e o corpo (PNG ou 502)
- [ ] 3.3 Se vier 502: ler o log da função na Vercel e anotar `step`, `status`, `reason` e `region`
- [ ] 3.4 Se vier imagem: fazer uma consulta completa com um selo real e captcha resolvido à mão, e confirmar que o resultado aparece (não "captcha errado")
- [ ] 3.5 Registrar em `design.md`, na seção "Resultado do spike", a hipótese confirmada (A ou B) com a evidência e a data

## 4. Encerramento conforme o resultado

- [ ] 4.1 Hipótese A: após o merge, repetir 3.2 e 3.4 em produção pelo host de um cartório (ex.: `www.cartorioielmomarinhorn.com`)
- [ ] 4.2 Hipótese B: manter a região e o log, anotar no PR que o `/selo` segue degradando para o card e o link oficial, e levantar a decisão de produto (proxy brasileiro × página educativa) como item separado
