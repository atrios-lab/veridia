## Why

O site público coleta dados pessoais (pedidos de serviço, agendamentos, ouvidoria, canal LGPD,
chat) e usa cookies, mas não publica uma política de privacidade — documento exigido pela LGPD
(Lei 13.709/2018, arts. 6º, VI e 9º) como dever de transparência do controlador. Também não há
aviso de cookies: o cidadão nunca é informado de que cookies existem nem registra ciência.

## What Changes

- Nova página pública `/privacidade` com a política de privacidade e proteção de dados da
  serventia: quais dados são coletados em cada canal, base legal, prazos de guarda, direitos do
  titular (com link para o canal `/lgpd` já existente), Encarregado (DPO) e a seção de cookies.
- O conteúdo variável (nome da serventia, CNS, contatos, Encarregado) vem da configuração do
  tenant; a estrutura do texto é fixa e comum a todas as serventias — nada de política por
  cartório.
- Banner de cookies exibido na primeira visita ao site público, informando que o site usa
  apenas cookies essenciais, com ação de ciência ("Entendi") e link para a política. A escolha
  é persistida e o banner não reaparece.
- Link "Política de privacidade" no rodapé do site público, ao lado das demais seções.

## Capabilities

### New Capabilities

- `privacy-policy-page`: página pública de política de privacidade e LGPD, com conteúdo
  institucional fixo e dados variáveis por tenant, acessível sem gating (obrigação legal de
  toda serventia, como o canal LGPD).
- `cookie-consent`: aviso de cookies na primeira visita, registro de ciência do cidadão e
  link para a política.

### Modified Capabilities

<!-- nenhuma: o rodapé é detalhe de implementação do layout público, sem mudança de requisito
     nas capacidades existentes -->

## Impact

- `src/app/(public)/privacidade/` — nova página (Server Component, sem formulário).
- `src/app/(public)/layout.tsx` — link no rodapé e montagem do banner de cookies.
- Novo componente cliente do banner (persistência da ciência no navegador).
- Sem mudança de banco, sem nova dependência, sem mudança no painel admin.
- Cookies hoje são só essenciais (sessão Better Auth no admin e token httpOnly do chat), então
  não há gestão de categorias de consentimento — o banner é de ciência, não de opt-in/opt-out.

## Non-goals

- Gestão granular de consentimento por categoria de cookies (analytics, marketing): não há
  cookies não essenciais no produto; adicionar preferências agora seria especulação.
- Editor de texto da política no painel admin: a política é estrutura fixa com dados do tenant;
  um editor viraria fork de conteúdo jurídico por cartório.
- Registro de consentimento em banco de dados: ciência de cookies essenciais não exige trilha
  auditável por titular; a persistência é local, no navegador.
- Alterar o canal LGPD (`/lgpd`) existente: a política apenas aponta para ele.
