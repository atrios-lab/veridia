## Context

A consulta do selo é um proxy transparente do SIEX (TJRN). A rota `/selo/captcha` abre uma sessão no TJ, busca `jcaptcha.jpg` nessa sessão e devolve a imagem ao cidadão com o `JSESSIONID` num cookie HttpOnly. Depois, a server action `lookupSeal` submete código e captcha na mesma sessão.

Estado em 29/09/2026:

```
                         Natal (IP residencial, Claro)   Vercel produção (iad1)
                         ─────────────────────────────   ──────────────────────
 GET siexnet (sessão)    200 + JSESSIONID  ✓             ✗ ┐
 GET jcaptcha.jpg        200 PNG 145×45    ✓             ✗ ┘→ 502 "O TJ não respondeu."
```

- O TJ fica atrás da Akamai (`edgesuite.net`). A falha em produção é rápida (~0,8s), e isso sugere recusa ativa, não timeout.
- A função roda em `iad1` porque é a região padrão do projeto, escolhida por ficar perto do Supabase (`us-east-1`).
- `openSession` e `fetchCaptcha` fazem `return undefined` tanto para `!response.ok` quanto no `catch {}`. Nada chega ao log, então não dá para distinguir 403 da Akamai, timeout ou erro de DNS.

## Goals / Non-Goals

**Goals:**
- Descobrir se o bloqueio é por país (A) ou por IP de datacenter (B), com evidência do log e não por inferência.
- Se for A, deixar o `/selo` funcionando em produção nesta mesma change.
- Deixar as falhas futuras com o TJ diagnosticáveis pelo log.

**Non-Goals:**
- Contornar bloqueio (headers, UA, retry, proxy). Ver proposta.
- Mudar a região do projeto ou de qualquer rota fora do `/selo`.

## Decisions

### 1. `preferredRegion = "gru1"` por rota, nas duas pontas da sessão

A rota `/selo/captcha` e a página `/selo` exportam `preferredRegion = "gru1"`. A server action `lookupSeal` executa na função da página que a invoca, então a configuração da página cobre o submit.

As duas pontas precisam estar na mesma região. Se a Akamai ou o SIEX amarrarem a sessão ao IP ou ao país de origem, abrir a sessão em `gru1` e submeter de `iad1` quebraria o submit de um jeito que parece "captcha errado". Mesmo região não garante mesmo IP (cada invocação pode sair de um IP diferente do pool da AWS), mas a sessão já sobrevive a isso hoje no dev, e o `JSESSIONID` carrega a afinidade de nó (`.jodi-petkoff`).

**Alternativas:**
- *Região do projeto inteiro em `gru1`*: descartada. Toda página do site passaria a cruzar o continente até o banco em us-east-1.
- *Só a rota do captcha em `gru1`*: descartada pelo motivo acima (sessão aberta e usada de países diferentes).
- *Route Handler dedicado para o submit, em vez da server action*: desnecessário. `preferredRegion` na página já resolve, sem mexer no transporte.

### 2. Registro da falha no próprio cliente do TJ, sem mudar o retorno

`openSession`, `fetchCaptcha` e `fetchLookupHtml` continuam devolvendo `undefined` na falha, e os chamadores não mudam. Antes de devolver, cada uma registra uma linha `console.warn` com:

- `step`: `"session" | "captcha" | "lookup"`
- `status` HTTP, quando houve resposta; para `session`, também se faltou o `JSESSIONID` numa resposta 200
- `reason`: `"timeout"` (`TimeoutError` do `AbortSignal`) ou o `name`/`message` do erro de rede
- `region`: `process.env.VERCEL_REGION`, para confirmar no log que a região pegou

Nunca entram no log: `JSESSIONID`, código do selo, texto do captcha, IP do cidadão. A sessão é do cidadão, e o código do selo leva a nome e CPF de terceiros.

Para ficar testável em processo, a montagem do objeto registrado vai para uma função pura (`describeTjFailure`, ou nome equivalente), coberta por `node --test`. O `console.warn` fica no transporte.

**Alternativa:** deixar o log só durante o spike e remover depois. Descartada: a próxima quebra do TJ (markup, Akamai, fora do ar) volta a ser invisível sem ele, e o custo é uma linha por falha.

### 3. Leitura do resultado: A ou B

Depois do deploy no Preview, chamar `/selo/captcha` pelo host de um tenant com a seção ligada.

| Resultado | Leitura | Próximo passo |
|---|---|---|
| Imagem PNG + cookie; consulta com captcha certo devolve o selo | **A — geobloqueio** | Merge; validar em produção pelo host de um cartório |
| 502 com `region: "gru1"` e `status: 403` (ou recusa equivalente) no log | **B — datacenter** | Manter a região (não piora nada); abrir decisão de produto: card permanente + link oficial, ou proxy em IP brasileiro |
| 502 com `region` diferente de `gru1` | região não aplicou | Conferir plano ou config da Vercel antes de concluir qualquer coisa |
| Captcha carrega mas o submit sempre volta "captcha errado" | sessão amarrada ao IP de saída | Investigar a afinidade da sessão; fica registrado aqui antes de qualquer mudança |

O resultado observado é registrado nesta seção (abaixo, em "Resultado do spike") antes de arquivar a change.

## Risks / Trade-offs

- [Bloqueio é por datacenter (B)] → A change entrega só o diagnóstico. O `/selo` continua caindo no card e no link oficial, que é a degradação que a spec já exige. A correção vira decisão de produto fora desta change.
- [Latência ao banco a partir de `gru1`] → A resolução do tenant (`getTenant`) consulta o Supabase em us-east-1, cerca de 120ms a mais por consulta, só nas duas funções do `/selo`. Aceitável numa página de consulta pontual.
- [Preview tem outro IP de saída que produção] → Ambos rodam na mesma infraestrutura de funções da Vercel na região escolhida. A validação final ainda é repetida em produção após o merge.
- [Upstash em outra região] → O rate limit faz uma chamada ao Redis por requisição. A latência extra é pequena e não afeta a corretude.
- [Log de erro com dado sensível] → A decisão 2 lista o que nunca entra. O teste da função pura garante que sessão, código e captcha não aparecem no objeto registrado.

## Migration Plan

Não há migração de banco. Deploy normal por PR. Rollback: reverter o commit. O `preferredRegion` é só configuração de rota.

## Open Questions

- O bloqueio é A ou B? É a pergunta que o spike responde.
- Se for B: vale um proxy em IP brasileiro (custo, operação, termos de uso do TJ) ou a página degrada de vez para educativa + link oficial? A decisão é de produto.

## Resultado do spike

_(preencher após a validação no Preview: hipótese confirmada, status e região vistos no log, data)_
