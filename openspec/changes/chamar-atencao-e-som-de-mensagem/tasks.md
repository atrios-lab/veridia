## 1. Som de nova mensagem

- [x] 1.1 `messageSound` (padrão Bolha) e `soundForAlerts`; testes
- [x] 1.2 Vigia toca com a conversa aberta, só o som
- [x] 1.3 "Som de nova mensagem" na configuração

## 2. Chamar atenção

- [x] 2.1 `core/chat/nudge.ts`: regra dos 10 minutos, linhas do chamado; testes
- [x] 2.2 `nudgeConversationWith` e chamados no snapshot; testes contra PGlite
- [x] 2.3 Rota: `intent=nudge` e `nudgeAvailableAt`; ação `nudgeCitizenAction`
- [x] 2.4 Painel: alerta `nudge` com toque próprio, tremor forçado, botão no console
- [x] 2.5 Site: botão com espera, chamado do cartório abre, treme, toca e vibra
- [x] 2.6 `shake.ts` compartilhado (tremor e vibração)

## 3. Verificação

- [x] 3.1 Bateria do CI
- [x] 3.2 Navegador com cidadão e atendente: som com a conversa aberta; botão travado e liberado; chamado nos dois sentidos treme e toca
