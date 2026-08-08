## Why

As abas **Encarregado** e **Cobrança** existem hoje só como rótulos inertes na faixa de
Configurações. As duas guardam dado que a serventia precisa corrigir sozinha e que hoje só muda
por deploy: o Encarregado de Dados é publicação obrigatória por lei (art. 41, §3º da Lei
13.709/2018) e troca quando a pessoa troca; a chave Pix é por onde entra o dinheiro do cidadão e
não existe no sistema em canto nenhum. Sem elas, "arrumar a casa" no painel ainda depende do
suporte.

## What Changes

- Aba **Encarregado**: formulário de nome e e-mail do DPO, gravado como override da serventia,
  refletido de imediato onde o DPO já aparece (bloco de contato da página LGPD e rodapé do PDF do
  requerimento). Sem override, continua valendo o valor do arquivo de configuração.
- Aba **Cobrança**: cadastro da chave Pix da serventia — tipo (CPF, CNPJ, e-mail, telefone,
  aleatória) e valor —, validado por formato conforme o tipo, com remoção explícita. Novo dado:
  não existe hoje nem em config nem em banco.
- Cobrança fica atrás de uma permissão nova, `billing.edit`, concedida só ao papel `admin`:
  operador vê a chave em leitura, sem botão de salvar, e a action recusa no servidor.
- A faixa de abas passa a navegar para as quatro; "em breve" sai da tela.
- Toda gravação e toda remoção de chave deixa linha em `audit_log`.

## Non-Goals

- **Não** gera QR Code, copia-e-cola nem qualquer payload Pix (BR Code/EMV) para o cidadão. O
  pedido de serviço não tem valor a cobrar hoje — não há `amountCents` em `service_requests` nem
  tabela de emolumentos por ato — então o QR da consulta de protocolo que o design mostra fica
  para a mudança que introduzir o valor devido. Esta mudança só guarda a chave.
- **Não** concilia pagamento: o sistema não fica sabendo quando o Pix cai, e a conferência
  continua sendo da serventia pelo extrato. Nada de webhook de PSP.
- **Não** valida se a conta é mesmo da serventia. O formato é conferível, a titularidade não.
- **Não** mexe em Usuários nem em Trocar senha, que estão na mesma entrega de design.
- **Não** torna o DPO um usuário do painel: é um contato publicado, não uma conta.

## Capabilities

### New Capabilities

- `admin-dpo-settings`: aba Encarregado — edição do nome e e-mail do DPO da serventia como
  override, sua validação e sua chegada ao site público.
- `admin-billing-settings`: aba Cobrança — cadastro, validação por tipo, leitura restrita e
  remoção da chave Pix da serventia.

### Modified Capabilities

- `admin-office-settings`: a faixa de abas deixa de ter abas inertes; as quatro navegam. O
  requisito que descreve "aba não implementada" some.
- `data-rights-channel`: o contato do Encarregado publicado na página passa a vir do override da
  serventia quando houver, e da configuração quando não houver.

## Impact

- `src/core/tenant/schema.ts`: campo `pix` opcional no `TenantSchema`, com o enum de tipos de
  chave e a validação por tipo.
- `src/core/tenant/overrides.ts`: dois picks novos (`OfficeDpoSchema`, `OfficePixSchema`) e as
  chaves correspondentes em `applyTenantOverrides`.
- `src/lib/tenant.ts`: duas chaves novas de `tenant_content` (`office-dpo`, `office-pix`) lidas na
  mesma consulta que já busca contato e marca.
- `src/core/auth/roles.ts`: permissão `billing.edit`.
- `src/app/admin/(dashboard)/configuracoes/`: duas rotas novas (`encarregado`, `cobranca`), cada
  uma com página, formulário e action; `_components/tabs.tsx` perde os `href: null`.
- Sem migração de banco: as duas gravações usam `tenant_content`, que já existe.
- Testes: `src/core/tenant/overrides.test.ts` e um teste novo para a validação de chave Pix; e2e
  em `e2e/admin-settings.spec.ts`.
