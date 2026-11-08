## 1. Núcleo e servidor

- [x] 1.1 `diffAlerts`, `queueNeedsAttention`, `waitingLabel`, toques e preferências em `core/chat/alerts.ts`, com testes
- [x] 1.2 `alertSnapshotWith` em `lib/chat.ts`, testado contra PGlite
- [x] 1.3 `alertSnapshotAction` (permissão `chat.manage`, erro vira rodada pulada)

## 2. Navegador

- [x] 2.1 Tocador Web Audio com desbloqueio no primeiro clique
- [x] 2.2 Preferências no localStorage, seguindo mudanças entre abas
- [x] 2.3 Vigia no layout: consulta em segundo plano, som, notificação, título piscando, cartão piscando, repetir até atender
- [x] 2.4 "Avisos do atendimento" na tela de Atendimento

## 3. Verificação

- [x] 3.1 Bateria do CI
- [x] 3.2 Ponta a ponta no navegador: conversa nova com o atendente em Pedidos gera cartão, notificação e som
