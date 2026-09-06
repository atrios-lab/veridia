## Context

`src/flags.ts` declara `citizenTrackingV2` com o Flags SDK genérico (`flags/next`) e hoje escolhe o adapter na mão:

```ts
...(process.env.EDGE_CONFIG
  ? { adapter: globalConfigAdapter }   // @flags-sdk/global-config
  : { decide: () => false }),          // sem EDGE_CONFIG: sempre desligada
```

O valor real vive num Edge Config (`veridia-flags`, item `flags`, chave `citizen-tracking-v2`), editado manualmente como JSON. `trackingHref()` (único ponto de leitura) e o endpoint `/.well-known/vercel/flags` (Flags Discovery, para o Toolbar) não conhecem o adapter — só chamam `citizenTrackingV2()` / `getProviderData()`, que são agnósticos de provider.

O Vercel Flags nativo (GA) resolve o mesmo problema — ligar/desligar sem deploy — sem precisar provisionar Edge Config: a flag é criada no dashboard **Flags** do projeto, e o app lê uma SDK Key (`FLAGS`) via um novo adapter, `@flags-sdk/vercel`.

## Goals / Non-Goals

**Goals:**
- Trocar o storage/adapter de Edge Config para Vercel Flags nativo, mantendo `trackingHref()` e todos os seus chamadores intocados.
- Preservar todo comportamento já especificado em `citizen-tracking-rollout`: fallback seguro, zero config extra em dev/CI, override por sessão no Toolbar, flag nunca exposta ao cliente.
- Sair com um caminho de rollback claro caso o Vercel Flags apresente problema (o Edge Config atual não é apagado até a migração ser validada em produção).

**Non-Goals:**
- Não adota entities/segments/experiments do Vercel Flags — a flag continua um único boolean global.
- Não muda o endpoint `/.well-known/vercel/flags` (Flags Discovery): ele já é agnóstico de adapter, só chama `getProviderData`.
- Não muda o mecanismo de override do Toolbar em si (cookie `vercel-flag-overrides` cifrado com `FLAGS_SECRET`) — isso é do pacote `flags`, não do adapter.

## Decisions

### Adapter: `@flags-sdk/vercel` no lugar de `@flags-sdk/global-config`

```ts
import { vercelAdapter } from "@flags-sdk/vercel";

export const citizenTrackingV2 = flag<boolean>({
  key: "citizen-tracking-v2",
  description: "...",
  defaultValue: false,
  adapter: vercelAdapter,
});
```

A condição hoje baseada em `process.env.EDGE_CONFIG` (dev/CI sem Edge Config → sempre `false`) precisa de um equivalente para Vercel Flags: sem a SDK Key (`process.env.FLAGS` ausente), usar `decide: () => false` do mesmo jeito. **Confirmar em código**: se `vercelAdapter` já degrada sozinho para `defaultValue` sem `FLAGS` configurada (ver "Built-in resilience" da doc), a condição manual pode nem ser necessária — só manter o `try/catch` de `trackingHref()` como rede de segurança, igual hoje.

Alternativa descartada: manter `@flags-sdk/global-config` e só trocar de Edge Config para o novo produto por fora — não existe, Vercel Flags não é um Edge Config, é um serviço próprio com seu próprio adapter.

### Variável de ambiente: `FLAGS` (SDK Key) no lugar de `EDGE_CONFIG`

Local: `vercel env pull` (autentica via OIDC do projeto) preenche `.env.local`. Preview/Production: a Vercel injeta a SDK Key automaticamente para projetos com Vercel Flags habilitado — **confirmar durante a implementação** se ainda é preciso declarar `FLAGS` manualmente em Project Settings → Environment Variables, ou se isso é automático (a doc sugere que sim para projetos conectados). `FLAGS_SECRET` não muda.

### Criação da flag: dashboard, não JSON

A flag `citizen-tracking-v2` é recriada no dashboard **Flags** do projeto (Boolean, default `false`, Production/Preview off até validar, Development como preferir). Isso substitui a edição manual do item `flags` no Edge Config. Sem draft: como o app já declara a flag em código antes desta mudança, o Vercel pode detectá-la via Flags Discovery e oferecer como **draft** para promoção — vale checar se é mais rápido criar direto no dashboard com a mesma `key` (`citizen-tracking-v2`) ou promover o draft detectado.

### Ordem de corte: paralelo, depois desliga o Edge Config

1. Criar a flag no Vercel Flags (desligada) e configurar `FLAGS`.
2. Trocar o adapter em código, deploy em preview, validar os três cenários do e2e existente contra o preview.
3. Deploy em produção com Vercel Flags desligado (paridade com o Edge Config, que também está desligado hoje).
4. Só depois de um deploy estável, remover a variável `EDGE_CONFIG` dos ambientes e o Edge Config `veridia-flags` do Storage.

Isso mantém sempre um caminho de volta: enquanto o Edge Config não é removido, reverter o commit do adapter restaura o comportamento anterior sem depender de nada no Vercel Flags.

## Risks / Trade-offs

- **Formato do cookie de override pode diferir por adapter** → o e2e usa `encryptOverrides` do pacote `flags` diretamente (não do adapter), então deve continuar funcionando; validar rodando `e2e/citizen-tracking-flag.spec.ts` contra o novo adapter antes de remover o Edge Config.
- **SDK Key ausente em CI** → sem `FLAGS` no ambiente de CI, garantir que o adapter (ou o `decide` manual) cai em `defaultValue: false` do mesmo jeito que hoje sem `EDGE_CONFIG`, senão o job de e2e quebra.
- **Flags Discovery detectar a flag como draft duplicado** → se o Vercel já tiver criado um draft a partir do código antes de criarmos a flag manualmente no dashboard, pode haver conflito de `key`; checar o dashboard antes de criar a flag manualmente.
- **Remover o Edge Config cedo demais** → mitigado pela ordem de corte acima (passo 4 só depois de produção estável).

## Migration Plan

Ver "Ordem de corte" em Decisions. Rollback a qualquer ponto antes do passo 4: reverter o commit do adapter (o Edge Config e `EDGE_CONFIG` continuam intactos até lá).

## Open Questions

- `vercelAdapter` precisa mesmo de um `decide: () => false` manual para dev/CI sem `FLAGS`, ou o built-in resilience da doc já cobre isso com `defaultValue`? Decidir lendo o código-fonte do `@flags-sdk/vercel` ou testando localmente antes de escrever tasks.md em detalhe.
- A SDK Key de Preview/Production é injetada automaticamente pela Vercel ou precisa ser declarada manualmente em Environment Variables? Afeta se `.env.example`/README precisam listar `FLAGS` como algo a configurar ou só documentar que existe.
