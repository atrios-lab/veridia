## 1. Provisionar Vercel Flags

- [ ] 1.1 Criar a flag `citizen-tracking-v2` no dashboard Flags do projeto (Boolean, default `false`, desligada em Preview/Production) — checar antes se ela já aparece como draft detectado via Flags Discovery e, se sim, promovê-la em vez de criar duplicada
- [ ] 1.2 Rodar `vercel link` (se preciso) e `vercel env pull` localmente para confirmar que a SDK Key (`FLAGS`) cai em `.env.local`
- [ ] 1.3 Confirmar se `FLAGS` precisa ser declarada manualmente em Preview/Production (Project Settings → Environment Variables) ou se é automática; registrar a resposta no design.md (Open Questions)

## 2. Trocar o adapter em código

- [ ] 2.1 Adicionar `@flags-sdk/vercel` e remover `@flags-sdk/global-config` de `package.json`
- [ ] 2.2 Atualizar `src/flags.ts`: trocar `globalConfigAdapter` por `vercelAdapter`; decidir se o `decide: () => false` manual para dev/CI sem `FLAGS` ainda é necessário (ver Open Questions do design.md) ou se o built-in resilience do adapter já cobre
- [ ] 2.3 Confirmar que `trackingHref()` e o `try/catch` continuam sem alteração (nenhum chamador muda)

## 3. Validar

- [ ] 3.1 Rodar `e2e/citizen-tracking-flag.spec.ts` localmente contra o novo adapter, sem `FLAGS` definida (deve continuar desligada por padrão)
- [ ] 3.2 Deploy em Preview com a flag desligada no dashboard; validar os três pontos de entrada (cabeçalho, rodapé, home) e acesso direto às duas rotas
- [ ] 3.3 Ligar a flag em Preview pelo dashboard e repetir a validação; desligar de volta
- [ ] 3.4 Confirmar no HTML de resposta que o valor da flag não vaza ao cliente (mesmo teste que já existe no e2e)

## 4. Atualizar documentação e limpar

- [ ] 4.1 Atualizar `README.md` (seção Deploy): trocar `EDGE_CONFIG` por `FLAGS`, passo `vercel env pull` no lugar da connection string manual
- [ ] 4.2 Atualizar `.env.example`: remover `EDGE_CONFIG`, documentar `FLAGS` (opcional, mesma lógica de "sem ela a flag fica desligada")
- [ ] 4.3 Deploy em Production com o novo adapter, flag desligada (paridade com o estado atual)
- [ ] 4.4 Depois de um período estável em produção: remover a variável `EDGE_CONFIG` dos ambientes e apagar o Edge Config `veridia-flags` do Storage
- [ ] 4.5 Atualizar o comentário de `src/flags.ts` e o link para `openspec/changes/feature-flag-acompanhar` se a numeração/nome da change mudou algo relevante
