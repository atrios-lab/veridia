## Why

A consulta do selo digital (`/selo`) está quebrada em produção: `/selo/captcha` responde sempre `502 "O TJ não respondeu."`, e o cidadão vê só "Não foi possível carregar a imagem do TJ". Verificado em 29/09/2026 no Marinho e em Macaíba. O fluxo em si funciona: chamado de um IP residencial em Natal, o SIEX abre a sessão e devolve o PNG do captcha normalmente, e o markup do TJ não mudou. O que muda em produção é a origem da chamada: a função roda em `iad1` (Washington; `x-vercel-id: gru1::iad1`), e o TJ fica atrás da Akamai (`selodigital.tjrn.jus.br → edgesuite.net`), que recusa rápido (~0,8s, bem antes do timeout de 10s). A consulta funcionava em produção, e a mudança foi do lado do TJ, não nossa: `tj-seal.ts`, a rota e a action não mudam desde 22/08, todos os deploys de produção desde 30/08 rodaram em `iad1`, e o deploy de 30/08 (com o código e as variáveis de ambiente da época) dá o mesmo 502 hoje. A migração do banco para o Supabase `us-east-1` foi em 14/08, antes de o selo existir, e o 502 só sai depois de a resolução do tenant ter lido o banco com sucesso. O risco estava previsto no design da change original (`2026-08-22-consultar-selo-digital`, risco "Akamai passa a bloquear IPs da Vercel").

Falta uma informação para decidir a correção: se o bloqueio é **por país** (resolve rodando no Brasil) ou **por IP de datacenter** (não resolve com região). O código hoje descarta o status e a exceção de cada chamada ao TJ, então os logs da Vercel mostram só o 502. Esta change é um spike que responde essa pergunta e, se a resposta for "por país", já entrega a correção.

## What Changes

- As chamadas ao TJ (`openSession`, `fetchCaptcha` e o submit da consulta) passam a registrar no log do servidor a etapa que falhou e o motivo (status HTTP, timeout ou erro de rede), sem dado do cidadão. O comportamento para o cidadão não muda.
- A rota `/selo/captcha` e a página `/selo` (cuja função também executa a server action `lookupSeal`) passam a rodar em `gru1` (São Paulo) via `preferredRegion`. Assim, as duas pontas da mesma sessão do TJ saem do Brasil.
- Validação no Preview (Homolog), com leitura do log para registrar no design qual das hipóteses se confirmou.
- Se o bloqueio for por datacenter (hipótese B), a região fica como está (não piora nada) e o caminho definitivo vira decisão de produto registrada no design. Não entra nesta change.

## Não-objetivos

- Contornar o bloqueio com headers forjados, User-Agent de navegador, retry ou rotação de IP. A decisão 6 do design original continua valendo: não disputamos com a Akamai.
- Proxy em IP brasileiro não-datacenter, webservice conveniado com o TJ ou qualquer outro canal alternativo. Se a hipótese B se confirmar, isso vira change própria depois da decisão de produto.
- Mover a região do projeto inteiro. O banco (Supabase) está em `us-east-1`, e o resto do site continua em `iad1`.
- Mudar a UI do `/selo`, o parser ou o rate limit.
- Automatizar ou cachear captcha, que continua proibido pela spec.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `digital-seal-lookup`: entram dois requisitos novos. As chamadas ao TJ devem partir do Brasil, e cada falha na conversa com o TJ deve deixar no log do servidor a etapa e o motivo, sem dado pessoal.

## Impact

- `src/lib/tj-seal.ts`: registro da falha em `openSession`, `fetchCaptcha` e `fetchLookupHtml`.
- `src/app/(public)/selo/captcha/route.ts` e `src/app/(public)/selo/page.tsx`: `export const preferredRegion = "gru1"`.
- Latência: cada consulta ao banco feita por essas duas funções (resolução do tenant) cruza São Paulo → us-east-1 (~120ms). Isso só vale para o `/selo`.
- Vercel: `preferredRegion` por rota funciona no plano atual e não exige configuração no painel. Se o plano não permitir a região, o build avisa (ver design).
