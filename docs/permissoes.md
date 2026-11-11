# Permissões por recurso

Regra do produto (11/11/2026): **todo recurso novo do painel aparece em
Configurações › Perfis e permissões**, para o Tabelião/Registrador decidir quem
usa.

## Como acrescentar um recurso

1. Crie a permissão em `src/core/auth/roles.ts`, nas listas
   `OFFICE_PERMISSIONS` e `GRANTABLE_PERMISSIONS`.
2. Dê o nome dela em `GRANTABLE_LABELS`. Esse é o texto que aparece na tela.
3. Diga de qual permissão antiga ela veio em `DERIVED_FROM`. Quem tinha a
   antiga recebe a nova até o Tabelião decidir. Assim ninguém perde, no dia da
   mudança, o que já fazia.
4. Use a permissão nova no item do menu (`nav.ts`), nas páginas, nas rotas e
   nas ações do recurso.

O teste `nav.test.ts` falha se um item do menu usar uma permissão que não
aparece em Perfis e permissões. Ele também falha se dois utilitários dividirem
a mesma permissão.

## Como a herança funciona

- Cargo sem configuração salva: os padrões de `roles.ts`, com as permissões
  herdadas.
- Configuração salva antes da permissão existir: a nova segue a antiga.
- Configuração salva depois: vale o que o Tabelião marcou (a lista `known`
  guarda as permissões que existiam quando ele salvou).

## Permissões criadas em 11/11/2026

| Permissão | Na tela | Veio de |
| --- | --- | --- |
| `guides.manage` | Guias de transmissão de bens | Pedidos de serviço |
| `iss.manage` | Declaração de ISS | Pedidos de serviço |
| `signer.use` | Assinador digital | Visão geral |
| `transparency.manage` | Transparência | Editar o site |
| `numbering.manage` | Numeração de documentos | Editar o site |
| `access.manage` | Duas etapas e horário de acesso | Só o Tabelião |
| `certificates.manage` | Certificados digitais | Só o Tabelião |
| `security-paper.manage` | Papel de segurança | Pedidos de serviço |
