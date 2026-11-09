## Why

Cada parte do site que traz novidade (chat, agenda, guias, pedidos, LGPD, ouvidoria) avisava do seu
jeito, sem a serventia poder escolher. O cartório pediu um lugar só, em Configurações, para decidir por
canal se o painel avisa ou fica em silêncio, se aparece o aviso na tela, a notificação do navegador, qual
som toca e se a tela treme (e o celular vibra).

## What Changes

- Nova aba **Configurações › Notificações** (permissão `content.edit`), com um cartão por canal:
  - **Notificar / Silenciar**;
  - **Aparecer o aviso na tela**, **Notificação do navegador**, **Tremer a tela e vibrar**;
  - **Som**, com os mesmos toques do atendimento, "Sem som" e o botão **Ouvir**;
  - botão para permitir as notificações neste navegador e **Voltar ao padrão**.
- A escolha é da serventia, vale para todos os atendentes e fica em `tenant_content`
  (`office-alerts`), com auditoria. **Banco: nenhuma migração.**
- Os avisos do chat, da agenda e das guias passam a seguir a escolha. No chat, o volume e a repetição
  continuam sendo de cada computador; um canal silenciado não toca nem treme, nem com o "Chamar atenção"
  do cidadão.
- Avisos novos de **pedido de serviço**, **requerimento LGPD** e **manifestação na ouvidoria** feitos pelo
  site (não os que o balcão registrou, nem as guias, que têm aviso próprio), cada um só para quem trabalha
  o canal.
