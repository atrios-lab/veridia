# Design — Consultar Selo Digital

## Context

O SIEX do TJRN (`selodigital.tjrn.jus.br/siex/siexnet`) expõe a consulta pública de selo como um formulário POST clássico de aplicação Java (JBoss), sem autenticação, protegido por captcha de sessão. Recon de 2026-08-22 validou a mecânica por HTTP puro, sem browser:

- `GET siexnet?visaoId=...VisaoConsultaPorCodigoNaInternet` → `Set-Cookie: JSESSIONID=...; path=/siex`.
- `GET /siex/jcaptcha.jpg` com o cookie → PNG 145×45 da sessão (apesar do nome .jpg).
- `POST /siex/siexnet` com o cookie e os campos `visaoId`, `controladorId`, `idDoUsuarioDaSessao=usuarioExterno`, `nomeDaPagina=relacao`, `comando=abrirConsulta`, `enderecoDoServlet=siexnet`, `visaoAnterior`, `skin=`, `tokenDePaginacao=1`, `codigo`, `captcha` → 200 com página iso-8859-1; erros vêm num bloco `div.mensagemDaPagina` (ex.: "O valor inserido não corresponde ao da imagem.").
- O campo `codigo` aceita vários selos separados por `;`.
- O HTML de **sucesso** nunca foi observado: exige selo real + captcha resolvido por humano. O parser nasce de fixture capturada manualmente.

Restrições da plataforma que moldam o design: regra em núcleo puro (`src/core`, sem I/O), transporte em `src/lib` + route handlers; Upstash Redis existe mas **só em produção** (dev e CI rodam sem ele, ver `src/lib/rate-limit.ts`); serverless na Vercel (nada persiste entre invocações); texto visível em português; nenhum hex fora de `@theme`.

Princípio inegociável herdado da proposta: o captcha é sempre resolvido pelo cidadão. Nenhum caminho do código resolve, contorna ou cacheia captcha.

## Goals / Non-Goals

**Goals:**

- `/selo` funcional: código do selo + captcha do TJ na nossa UI, resultado na identidade da serventia.
- Zero estado no servidor: a sessão TJ viaja num cookie do próprio cidadão.
- Falha honesta: TJ fora do ar, Akamai bloqueando ou markup mudado → card de indisponibilidade + link para a consulta oficial (o link é permanente, não só no erro).
- Parser puro, testado contra fixtures reais capturadas do SIEX.

**Non-Goals:** os da proposta (sem automação de captcha, sem webservice conveniado, sem outros tribunais, sem persistência de consultas).

## Decisions

**1. Sessão TJ no cookie do cidadão, não no Redis.**
O `JSESSIONID` do TJ é gravado num cookie HttpOnly nosso (`tj-seal-session`, `path=/selo`, `maxAge` ~10 min, `secure`, `sameSite=lax`). Alternativa considerada: token opaco → Redis (proposta original). Rejeitada porque Redis não existe em dev/CI (a consulta não funcionaria localmente), adiciona uma escrita/leitura por consulta e resolve um problema que não temos — o `JSESSIONID` não é segredo nosso: é a credencial de sessão do próprio cidadão para uma consulta pública sem login. Devolvê-la ao dono é o desenho mais simples e o único sem estado. Adulteração não compra nada (o TJ rejeita sessão inválida e a UI mostra "captcha expirado, gere outro").

**2. Duas rotas + uma server action, todas finas.**

```
GET  /selo            page.tsx: gating requireSection("selo-tjrn"), form client
GET  /selo/captcha    route handler: abre sessão nova no TJ, baixa o PNG,
                      seta o cookie tj-seal-session, responde image/png
                      (Cache-Control: no-store)
POST (server action)  lê o cookie, valida campos, replay do POST ao SIEX,
                      parseia, devolve resultado tipado pro client
```

"Gerar novo código" na UI = recarregar `/selo/captcha` com cache-buster: cada carga abre sessão TJ nova e sobrescreve o cookie. Sem `atualizarCaptcha()` do TJ, sem reuso de sessão — uma sessão por captcha exibido, o modelo mais simples que existe.

**Achado de campo (2026-08-22): a Akamai cacheia `jcaptcha.jpg`.** Três GETs em sessões distintas devolveram o mesmo PNG byte a byte — imagem velha que não corresponde ao desafio da sessão, e o TJ recusa o texto correto. `fetchCaptcha` DEVE anexar query string única (`jcaptcha.jpg?ts=<aleatório>`) a cada busca; é o mesmo truque do `atualizarCaptcha()` do próprio site. Sem isso o fluxo falha sempre, com aparência de captcha errado.

**Segundo achado: `tokenDePaginacao` incrementa por sessão.** A resposta (inclusive de erro) vem com `tokenDePaginacao=2`; reenviar na mesma sessão com o token velho é comportamento não mapeado. Reforça o modelo sessão-nova-por-tentativa: nunca reusar sessão para um segundo POST.

**3. Parse em núcleo puro; I/O isolado num cliente.**
`src/core/seal/parse.ts`: `parseSealLookup(html: string)` → união discriminada `{ kind: "seals", seals: [...] } | { kind: "message", text: string } | { kind: "unrecognized" }`. Sem regex-soup: extrai `div.mensagemDaPagina` (formato validado) e a estrutura de resultado (formato a confirmar pela fixture). `unrecognized` é resultado de primeira classe: markup que não reconhecemos vira card de indisponibilidade com o link oficial, nunca dado inventado. `src/lib/tj-seal.ts` concentra o I/O: `openSession()`, `fetchCaptcha(sessionId)`, `submitLookup(sessionId, codes, captcha)` com timeout curto (~10s) e decodificação `iso-8859-1` (`TextDecoder("iso-8859-1")` sobre o buffer).

**4. Fixture de sucesso: capturada (2026-08-22, selo real da serventia, captcha resolvido pelo usuário).**
Está em `recon/response-success.html`, **anonimizada** (nome e CPF do campo Objeto trocados por valores fictícios — a estrutura é o que o parser precisa, o dado pessoal não entra no repo). O formato observado:

- Página de sucesso se distingue da de erro pela estrutura: sucesso tem `form#principal` com `nomeDaPagina=consulta` e o resultado num `div.conteudoSemRotulo` (id aleatório, ex. `campo_oidcjq`); erro tem `controladorId=...ControladorMensagem` e `div.mensagemDaPagina`.
- O resultado é um blob único de linhas `Label: valor` separadas por `<br>`, com seções em `<b>` (`Cartório`, `Guias associadas`, `Selos vinculados`, `Lançamentos realizados (Ativos)`), abrindo com `<h3>Código: RN... (Atualizado)</h3>` e fechando com `N lançamento(s)` + `<hr>` + o aviso de conferência.
- Campos observados: Lote de Geração, Cartório, Gerado em, Origem, Status do andamento, Atualizado em, Objeto (contém nome e CPF do apresentante), Isento, Valor selo, Cortesia, guias (número/status), e por lançamento: datas, Código Referente, Referente (nome do ato), Quantidade e a decomposição de valores (Emolumentos, TJRN, FCRCPN, FRMP, FPGE, ISSQN, Total).
- **Armadilha de formato monetário**: o TJ mistura vírgula e ponto decimais na mesma página ("R$ 0,05" e "R$ 4.21"). O parser não converte valores para número — repassa as strings como vieram; quem confere é o cidadão contra o documento.

O parser de sucesso extrai o blob e o quebra em seções/linhas para renderização estruturada; qualquer desvio estrutural vira `unrecognized`. `scripts/capture-seal-fixture.ts` continua nas tasks como ferramenta de recaptura para quando o TJ mudar o markup.

**5. Rate limit com orçamento próprio.**
Novo limiter em `rate-limit.ts` (prefixo `veridia:seal`, ~10/min por IP), cobrindo `/selo/captcha` e a action. Cada consulta nossa custa 2 requisições ao TJ (sessão+captcha, depois submit); o limite protege o TJ de nós e nós do abuso. Como os demais, desliga sem Upstash configurado.

**6. Sem User-Agent forjado, sem retry agressivo.**
As requisições ao TJ vão com o UA default do fetch do Node. Se a Akamai decidir bloquear IP de datacenter, a resposta é o card de indisponibilidade e o link oficial — não uma corrida armamentista de headers. Mesma razão: 1 tentativa por submit, sem retry automático (retry num POST de consulta com captcha só queima a sessão).

**7. UI: um campo, resultado na página, aviso legal.**
Campo único de texto (aceita `;` para vários selos, repassado como está), imagem do captcha com "gerar novo código", botão consultar. Resultado renderizado em cards do design system do tenant. Texto fixo reproduzindo o aviso do TJ com palavras nossas: conferência simples, não substitui o documento original, dúvidas com o cartório emissor. Link "consultar direto no site do TJ" sempre visível no rodapé da página — é o fallback e a transparência de origem do dado.

## Risks / Trade-offs

- **[Markup do SIEX muda e o parse quebra]** → `unrecognized` é caminho tratado: card de indisponibilidade + link oficial, nunca erro 500 nem dado errado. Fixtures versionadas fazem o teste apontar exatamente o que mudou.
- **[Akamai passa a bloquear IPs da Vercel]** → mesmo caminho de indisponibilidade; decisão 6 assume que não competimos com o bloqueio. Se acontecer de forma permanente, a página degrada para a versão educativa + link (sem change nova: é o mesmo card).
- **[Cookie carrega o JSESSIONID do TJ]** → HttpOnly, secure, path restrito, TTL curto; o valor só serve para uma consulta pública sem login. Pior caso de vazamento: alguém consulta um selo com a sessão alheia — o mesmo que qualquer visitante do site do TJ já pode fazer.
- **[Sessão do TJ expira entre ver o captcha e enviar]** → mensagem clara ("o código expirou, gere um novo") derivada do `kind: "message"` do TJ ou da ausência do cookie; nunca um erro genérico.
- **[Fixture depende de selo real da serventia]** → tarefa explícita com o usuário no loop; até lá o fluxo funciona com as mensagens do próprio TJ (validadas no recon).

## Migration Plan

Deploy puramente aditivo: rotas novas + página reescrita, zero banco, zero env var nova (Upstash já existe em produção). Rollback = reverter o deploy; `/selo` volta ao `ComingSoon`.

## Open Questions

Nenhuma — as duas originais foram respondidas em campo (2026-08-22):

- Formato do HTML de sucesso: documentado na decisão 4, fixture em `recon/response-success.html`.
- Formato do código do selo: `RN` + ano (4) + CNS da serventia (6, com zero à esquerda: `094615`) + sequência (7) + sufixo (3 letras). Ex. real: `RN202600946150001796UXB`. Vale como placeholder do campo (`Ex.: RN2026...`), mas o campo não valida formato — o TJ é a autoridade.
