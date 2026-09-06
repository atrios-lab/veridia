## 1. Infraestrutura e dependência

- [ ] 1.1 Adicionar o pacote `flags` (Flags SDK da Vercel) às dependências de produção
- [ ] 1.2 Provisionar um Edge Config no projeto Vercel (`veridia`) e conectá-lo ao projeto
- [ ] 1.3 Configurar a variável de conexão do Edge Config (`EDGE_CONFIG` ou o nome que o SDK exigir) nos ambientes de Preview e Production na Vercel
- [ ] 1.4 Confirmar que `pnpm dev` e o CI continuam funcionando sem essa variável definida (comportamento padrão = flag desligada)

## 2. Declarar a flag

- [ ] 2.1 Criar `src/flags.ts` com a flag (nome sugerido: `citizenTrackingV2`), `defaultValue: false`, descrição curta apontando para este change do OpenSpec
- [ ] 2.2 Confirmar no Vercel Toolbar (ambiente de preview) que a flag aparece e pode ser sobrescrita por sessão

## 3. Centralizar onde a flag decide o destino

- [ ] 3.1 Ler `src/core/tenant/gating.ts` (`SECTION_ROUTES`, `sectionNavLinks`) para confirmar que "Consultar protocolo" no cabeçalho, rodapé e qualquer CTA de home passam todos por esse único ponto
- [ ] 3.2 Adaptar esse ponto (ou introduzir um helper `trackingHref()` chamado a partir dele) para resolver `consulta-protocolo` como `/acompanhar` quando a flag estiver ligada e `/protocolo` quando desligada, sem duplicar a leitura da flag em cada call site
- [ ] 3.3 Atualizar as chamadas que hoje tratam `SECTION_ROUTES`/`sectionNavLinks` como síncronas, se a leitura da flag exigir `await` (Server Components ou wrapper apropriado)
- [ ] 3.4 Verificar que `/protocolo` e `/acompanhar` continuam respondendo normalmente por acesso direto, independente do valor da flag (nenhum redirect ou bloqueio de rota)

## 4. Testes

- [ ] 4.1 Cobrir com teste automatizado: flag desligada → cabeçalho, rodapé e home apontam para `/protocolo`
- [ ] 4.2 Cobrir com teste automatizado: flag ligada (via override, sem Edge Config real) → cabeçalho, rodapé e home apontam para `/acompanhar`
- [ ] 4.3 Cobrir: acesso direto a `/acompanhar` com a flag desligada continua funcionando
- [ ] 4.4 Cobrir: acesso direto a `/protocolo` com a flag ligada continua funcionando
- [ ] 4.5 Cobrir: leitura da flag falhando (Edge Config inacessível, simulado) cai para o padrão sem quebrar a renderização
- [ ] 4.6 Rodar `pnpm check:tokens`, `pnpm check:dashes`, `pnpm typecheck`, `pnpm lint` e `pnpm e2e` de ponta a ponta

## 5. Rollout

- [ ] 5.1 Publicar com a flag desligada (sem mudança visível) e confirmar em produção
- [ ] 5.2 Ligar via override do Toolbar só para o time; validar manualmente em pelo menos dois tenants com temas diferentes
- [ ] 5.3 Ligar no Edge Config para Preview; validar
- [ ] 5.4 Ligar no Edge Config para Production
- [ ] 5.5 Documentar no README (seção "Deploy") a existência da flag, a variável de Edge Config e como fazer rollback (voltar o valor para `false`)
