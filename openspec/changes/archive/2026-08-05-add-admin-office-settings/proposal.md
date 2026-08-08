# Proposta: Painel admin — casca e Configurações, aba Serventia (Entrega 4, parte 1)

## Why

O painel administrativo hoje é uma casca sem casca: `(dashboard)/layout.tsx` está marcado no
código como "No style on purpose" e imprime e-mail, papel e nome da serventia em HTML cru, com um
botão "Sair". Não existe navegação, não existe nenhuma tela além da home vazia, e não existe
lugar nenhum onde o registrador altere um dado da própria serventia — horário de atendimento,
telefone, WhatsApp e e-mail são hoje config-as-code, e mudar o telefone do balcão exige commit e
deploy. É o dado que mais muda e o que menos deveria depender de desenvolvedor.

O redesign aprovado no Claude Design ("Redesign 04 - Admin Config, Usuários e Senha", projeto
`558c4556-caed-4f30-9c6b-648f995805cf`) é a primeira entrega de UI do painel propriamente dito.
Esta proposta cobre a primeira das três telas da entrega: **Configurações — aba Serventia**, mais
a casca (sidebar + cabeçalho) sem a qual nenhuma tela do painel existe.

## What Changes

- **Casca do painel** (`src/app/admin/(dashboard)/layout.tsx`): sidebar verde-escura fixa com o
  selo branco da serventia, nome e "Painel administrativo"; navegação agrupada por rótulo dourado
  (Operação / Canais do cidadão / Serventia); rodapé com iniciais, nome, papel e os atalhos
  "Trocar senha" e "Sair". Cabeçalho branco com o título da tela e a data por extenso. Estética
  fixa da plataforma — nunca o tema do tenant.
  - A sidebar renderiza **apenas os itens cujas rotas existem** (Visão geral, Configurações). Os
    demais grupos do design entram junto com as telas que eles apontam; item de menu que leva a
    404 é pior que item ausente.
- **Nova tela `/admin/configuracoes`** com a faixa de quatro abas do design (Serventia,
  Identidade Visual, Encarregado, Cobrança). Só **Serventia** é implementada; as outras três
  aparecem inertes e rotuladas "em breve", porque o desenho da faixa é a informação de que elas
  existem.
- **Aba Serventia — bloco editável "Atendimento e contato"**: horário de atendimento (frase),
  telefone, WhatsApp e e-mail. Um botão "Salvar". O que for salvo passa a valer no site público
  (topo da home, contato, rodapé) imediatamente — este dado é operacional, não editorial, e não
  tem rascunho.
- **Aba Serventia — bloco somente-leitura "Dados da serventia"**: nome e CNS em campos
  desabilitados com selo "Somente leitura", e as **seis** atribuições legais listadas com o
  estado escrito ("ativa" / "não ativa"). Mostrar as seis é deliberado: esconder a que está
  desligada gera a dúvida "cadê o RCPJ?".

  **Corrigido durante a implementação:** o design da Entrega 4 desenha essas atribuições como
  interruptores travados, e o próprio texto do design justifica isso dizendo que "mostrar sem
  deixar clicar evita o suporte *cliquei e não desligou*". Não evita. A primeira pessoa a abrir a
  tela tentou clicar. `aria-disabled` não vence o instinto de clicar num interruptor: um controle
  que não controla é uma promessa que a tela não cumpre. Viraram linhas com tique e o estado por
  extenso, e a razão subiu para antes da lista, onde é lida antes do clique que ela deveria
  evitar.
- **Camada de override do tenant**: `getTenant()` passa a mesclar, sobre a configuração em
  código, a linha de override gravada em `tenant_content` (chave `office-contact`). A mescla é
  função pura no núcleo (`src/core/tenant`); a leitura do banco fica no transporte. `resolveTenant`
  continua puro e sem I/O — o middleware roda no edge e não pode consultar banco.
- **Server action de gravação** com validação Zod reaproveitando os campos que já existem em
  `TenantSchema` (`contacts`, `openingHours`), checagem de permissão no servidor
  (`content.edit` + serventia da sessão) e registro em `audit_log`.

## Capabilities

### New Capabilities

- `admin-shell`: casca do painel administrativo — sidebar institucional com selo e navegação por
  grupos, cabeçalho com título e data, rodapé de usuário com papel e atalhos, e a regra de que a
  navegação só oferece o que a pessoa pode acessar e o que existe.
- `admin-office-settings`: tela de Configurações e a aba Serventia — o que a serventia edita
  (horário e contatos, com efeito imediato no site público), o que ela apenas confere (nome, CNS,
  atribuições) e por que a fronteira entre os dois é onde é.

### Modified Capabilities

Nenhuma. Não há specs em `openspec/specs/`; as capacidades das entregas anteriores ainda vivem
como delta nas mudanças não arquivadas.

## Não-objetivos

- **As outras três abas** (Identidade Visual, Encarregado, Cobrança) — cada uma é um fluxo
  próprio, com upload de logotipo, prévia ao vivo e "Salvar e publicar". Ficam para a parte 2.
- **Tela de Usuários e convite pela interface** — segunda tela da Entrega 4, proposta à parte.
- **Tela de Trocar senha dentro do painel** — terceira tela da Entrega 4. O atalho no rodapé da
  sidebar aponta para o fluxo de redefinição que já existe (`/admin/redefinir-senha`).
- **Tornar nome, CNS e atribuições editáveis.** Atribuição é ato de delegação do tribunal, não
  preferência: mudá-la muda quais seções o site oferece e quais atos o cidadão pode pedir. Segue
  config-as-code, alterada por commit revisado.
- **Editar a janela numérica de agendamento** (`scheduling.startHour/endHour/capacityPerSlot`).
  O design mostra só a frase de horário, e a frase é o que o cidadão lê; os números continuam em
  código. Consequência assumida e registrada no design: a serventia pode salvar "das 8h às 18h" e
  as faixas de agendamento continuarem parando às 14h. A parte 2 resolve, se resolver.
- **Rascunho/publicação para contatos.** A tabela `tenant_content` tem as duas colunas; esta
  mudança grava direto em `published`. Telefone errado no ar não espera revisão editorial.
- **Contadores e badges da sidebar** (4 pedidos, 1 LGPD, 2 ouvidoria) e a pílula "Disponível para
  o chat" — dependem de telas e de um canal de chat que não existem neste repositório.
- **Tema por tenant no painel.** Decisão já tomada: o painel é estética fixa da plataforma.

## Impact

- **Código novo**: `src/app/admin/(dashboard)/configuracoes/` (página, formulário, action),
  `src/app/admin/_components/` (sidebar, itens de navegação, campos de leitura), e o merge puro
  em `src/core/tenant/overrides.ts`.
- **Código alterado**: `src/app/admin/(dashboard)/layout.tsx` (ganha a casca),
  `src/lib/tenant.ts` (`getTenant` passa a mesclar override e a ser cacheado por request),
  `src/app/globals.css` (utilitários da casca, se os tokens `--color-admin-*` existentes não
  bastarem — nenhum hex novo fora de `@theme`).
- **Banco**: nenhuma migração. Usa `tenant_content` e `audit_log`, ambas já existentes.
- **Dependências**: nenhuma nova.
- **Risco a vigiar**: `getTenant()` é chamado por praticamente toda rota pública e admin (18
  arquivos). Passar a ler o banco ali é uma consulta a mais por request — mitigada por `cache()`
  do React e por a consulta ser uma linha por chave, mas é o ponto de atenção da mudança.
- **Testes**: unidade em `node --test` para o merge puro e para o schema de gravação; e2e
  Playwright para "editar telefone no painel e ver no rodapé do site público" e para "atribuição
  desligada aparece marcada como não ativa e não é clicável".
