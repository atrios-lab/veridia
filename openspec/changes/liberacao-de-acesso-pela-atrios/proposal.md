## Why

Quando uma serventia não consegue receber o código por e-mail (provedor fora do ar, caixa cheia, pedido do
titular), a conta mestre da Átrios precisa liberar o acesso dela sem desligar a verificação de todas as
outras nem mexer em variáveis da Vercel.

## What Changes

- Nova tela **Átrios › Liberação de acesso** (`/admin/atrios/liberacao-de-acesso`), visível só para a conta
  mestre da Átrios. Ela usa a permissão de plataforma `access.release`, que nenhum perfil de cartório tem.
- A tela lista **todas as serventias da plataforma**, com qualquer site em que for aberta, e mostra se a
  verificação em duas etapas de cada uma está ligada ou desligada.
- **Desligar** pede um motivo opcional. Com a verificação desligada, a serventia entra no painel só com a
  senha. **Ligar** volta a pedir o código no próximo login.
- A escolha fica no `tenant_content` da própria serventia (`platform-access-policy`) e entra na auditoria
  dela (`platform.two-step-off` e `platform.two-step-on`).
- Se a leitura da escolha falhar, a verificação continua pedindo o código, que é o lado seguro.
- **Banco:** nenhuma migração.
