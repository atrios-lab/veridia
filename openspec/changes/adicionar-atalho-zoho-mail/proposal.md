## Why

A caixa institucional das serventias vive no Zoho Mail, fora do painel. Hoje quem atende o
balcão sai do Veridia, procura a aba ou digita o endereço do webmail e volta — várias vezes por
dia, para a ferramenta que mais usa depois da fila de pedidos. Um item de menu apagando esse
atrito custa poucas linhas e não cria nenhuma dependência nova.

## What Changes

- A sidebar do painel passa a ter o item "Zoho Mail", no grupo "Operação", logo após "Pedidos de
  serviço", apontando para `https://mail.zoho.com/zm/#mail/folder/inbox`.
- `AdminNavItem` ganha o campo opcional `external`, que marca um item cujo destino está fora do
  aplicativo. Item externo abre em aba nomeada e reutilizada (`target="zoho"`), nunca uma aba
  nova por clique, e leva `rel="noreferrer"`.
- Item externo exibe um sinal visual de saída (`↗`) no mesmo espaço onde um item interno mostra
  o contador de pendências, para que "isso abre fora do painel" não seja uma surpresa.
- O conjunto de ícones do painel ganha `mail` (envelope). Reusar `inbox` não serve: já é o ícone
  de "Pedidos de serviço", que fica no item imediatamente acima.
- A URL é uma constante do código, igual para todas as serventias. Não vira campo do tenant nem
  variável de ambiente.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-shell` — o requisito "Navegação só oferece o que existe e o que a pessoa pode acessar"
  hoje restringe a navegação a rotas do próprio aplicativo. Passa a admitir, além delas, item
  externo declarado, com regras próprias de abertura, sinalização e ausência de estado de página
  atual.

## Impact

- `src/app/admin/_components/nav.ts` — novo item e novo campo no tipo.
- `src/app/admin/_components/sidebar.tsx` — ramo de renderização para item externo.
- `src/app/admin/_components/icon.tsx` — ícone `mail`.
- Sem migração de banco, sem dependência nova, sem alteração no site público.
- Nenhum efeito sobre autorização: o acesso à caixa continua sendo decidido pelo login do próprio
  Zoho, que o Veridia não intermedia.

## Non-Goals

- **Login automático no Zoho.** A sessão do webmail é um cookie do domínio `zoho.com`; nenhum
  parâmetro em link criado pelo Veridia a estabelece. O único caminho técnico seria o Veridia
  virar provedor de identidade SAML da serventia, o que transferiria para cá a identidade de
  e-mail do cartório inteira, inclusive de quem nunca abre o painel. Fica de fora. Na prática, o
  navegador do balcão mantém a sessão do Zoho, e a partir do segundo dia o clique já cai direto
  na caixa de entrada.
- **Guardar credenciais do Zoho** em qualquer forma, para qualquer fim.
- **Integração via API do Zoho** (OAuth, leitura de mensagens, caixa de entrada embutida no
  painel). É outro produto, não um botão.
- **URL por serventia.** Enquanto todas usarem o mesmo endereço, um campo no tenant seria
  configuração sem variação. Entra quando a primeira serventia tiver o seu.
- **Permissão própria para o item.** Nenhuma das permissões existentes descreve "usar a caixa
  institucional", e esconder o link nunca foi controle de acesso neste painel.
- **Outros produtos Zoho** (Desk, CRM, Sign, Books).
