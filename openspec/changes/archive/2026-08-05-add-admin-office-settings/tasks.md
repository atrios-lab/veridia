## 1. Camada de override do tenant

- [x] 1.1 Criar `src/core/tenant/overrides.ts` com `OfficeContactOverrideSchema` derivado de
      `TenantSchema.pick({ openingHours: true, contacts: true })` (versão parcial para leitura,
      versão obrigatória exportada para a gravação) e a função pura `applyTenantOverrides`
- [x] 1.2 `applyTenantOverrides` devolve o tenant de configuração intacto quando o JSON é nulo,
      malformado ou reprova no `safeParse` — nunca lança
- [x] 1.3 Testes `node --test` em `src/core/tenant/overrides.test.ts`: override completo,
      override parcial, override ausente, JSON corrompido, campo estrutural injetado no JSON
      (deve ser ignorado). O parcial é por bloco (`openingHours` ou `contacts`), não por campo
      solto dentro de `contacts`: o formulário grava os quatro juntos e um `contacts` pela
      metade é linha corrompida, não override legítimo
- [x] 1.4 Em `src/lib/tenant.ts`, ler a linha `tenant_content` de chave `office-contact` da
      serventia resolvida e aplicar a mescla; envolver a consulta em try/catch que cai para a
      configuração em código quando o banco falha
- [x] 1.5 Envolver `getTenant()` em `cache()` do React; `resolveTenant` continua puro e o
      middleware não toca o banco (ele nunca importou nenhum dos dois)

## 2. Casca do painel

- [x] 2.1 Criar `src/app/admin/_components/nav.ts` com a lista de itens
      `{ group, label, href, icon, permission? }`, contendo apenas Visão geral e Configurações
- [x] 2.2 Acrescentar a `AdminIcon` os nomes de ícone usados pela navegação e pela casca,
      seguindo o padrão de `PATHS` já existente
- [x] 2.3 Criar `src/app/admin/_components/sidebar.tsx`: selo `logos.seal.dark`, nome da
      serventia, "Painel administrativo", grupos com rótulo dourado, item atual com
      `aria-current="page"`, e filtro por `can(role, permission)`
- [x] 2.4 Rodapé da sidebar: iniciais (nome do usuário, com fallback para as duas primeiras
      letras do e-mail), nome, papel em português e "Sair".
      **Desvio do design:** o atalho "Trocar senha" não foi renderizado.
      `/admin/redefinir-senha` é a tela de convite e devolve ao painel quem já tem sessão, então
      o atalho seria um link que volta para onde a pessoa está. Entra junto com a tela de troca
      de senha do painel (terceira tela da Entrega 4). Spec de `admin-shell` ajustada
- [x] 2.5 Criar `src/app/admin/_components/page-header.tsx` com o título da tela e a data por
      extenso em português, formatada no fuso `OFFICE_TIME_ZONE`. A formatação virou
      `formatFullDate` em `src/core/scheduling/calendar.ts`, junto das que já existiam, em vez
      de um segundo formatador `Intl` dentro do componente — assim é pura e testável
- [x] 2.6 Reescrever `src/app/admin/(dashboard)/layout.tsx` para montar sidebar + cabeçalho +
      conteúdo, mantendo intacta a guarda de sessão e papel que já existe
- [x] 2.7 Ajustar `src/app/admin/(dashboard)/page.tsx` para viver dentro da casca sem duplicar
      cabeçalho
- [x] 2.8 `check:tokens` passa. Quatro tokens novos no `@theme`: `--palette-admin-accent`
      (dourado dos rótulos), `--palette-admin-on-dark-accent` (o mesmo papel na sidebar) e
      `--palette-admin-readonly-bg` (campo mostrado e não editável) e
      `--palette-admin-active-border` (borda esverdeada do cartão em vigor). O resto do design
      foi coberto pelos tokens `--color-admin-*` que já existiam

## 3. Tela de Configurações e aba Serventia

- [x] 3.1 Criar `src/app/admin/(dashboard)/configuracoes/page.tsx` com checagem de sessão,
      serventia e `content.edit` no servidor, e a faixa das quatro abas (três inertes,
      rotuladas "em breve", não focáveis). Quem não tem `content.edit` recebe 404, não um
      redirect explicativo: não há por que confirmar que a tela existe
- [x] 3.2 Bloco "Atendimento e contato": formulário com horário, telefone, WhatsApp e e-mail
      preenchidos pelo tenant já mesclado, e botão "Salvar"
- [x] 3.3 Bloco "Dados da serventia": nome e CNS em campos não editáveis com selo "Somente
      leitura"
- [x] 3.4 Grade das seis atribuições: rótulo, nome curto e o estado por extenso ("Delegada" /
      "Não delegada"), com a razão abaixo da lista.
      **Corrigido depois de ver a tela:** era interruptor travado, como no design original. O
      interruptor não sobrevive ao contato com quem usa — a primeira pessoa a abrir a tela clicou
      esperando salvar, que é exatamente o chamado que o design dizia estar evitando. O design no
      Claude Design foi então revisado (tique em círculo, "Delegada"/"Não delegada"), e a tela
      segue a revisão: nenhum elemento interativo no bloco.
      Os rótulos vêm de um mapa próprio do painel (`ATTRIBUTION_PANEL_LABELS`), não de
      `ATTRIBUTION_NAMES`/`ATTRIBUTION_SHORT_NAMES`: o design pede "Protesto / Protesto de
      Títulos" e "RCPJ / Pessoas Jurídicas", que nenhum dos dois mapas do núcleo produz — eles
      são escritos para o cidadão, este é escrito para o registrador
- [x] 3.5 Criar `configuracoes/actions.ts` com `saveOfficeContact`: sessão + `content.edit` +
      serventia, `parse` apenas do schema de override obrigatório, upsert em `tenant_content`
      com `onConflictDoUpdate`, `recordAudit({ action: "office-settings.save" })` e
      `revalidatePath("/", "layout")`
- [x] 3.6 Ligar o formulário à action com `useActionState`, exibindo erro por campo e mantendo
      os valores digitados no reenvio. O React 19 **reseta** um formulário não controlado quando
      a action resolve, então a action devolve o que recebeu e esses valores viram os
      `defaultValue` — sem isso o registrador perdia os três campos certos para corrigir o
      quarto (pego pelo e2e, não pela leitura do código)
- [x] 3.7 Confirmação de gravação visível na tela após sucesso

## 4. Testes

- [x] 4.1 Teste de unidade do schema de gravação: e-mail inválido, campo obrigatório vazio,
      campos estruturais ignorados (em `src/core/tenant/overrides.test.ts`)
- [x] 4.2 e2e `e2e/admin-settings.spec.ts`: registrador entra, altera o telefone, salva, recarrega
      e o novo telefone aparece no site público
- [x] 4.3 e2e: as seis atribuições aparecem com o estado por extenso, a nota está abaixo da
      lista, o bloco não contém `input`, `button` nem `role="switch"` (guarda de regressão contra
      o interruptor voltar), e nome e CNS não são inputs.
- [x] 4.3b **Lacuna fechada.** Semeado um admin para `tabelionato-aurora` (só `NOTAS`) com
      `pnpm db:seed` + `ADMIN_SEED_TENANT`, credenciais em `AURORA_ADMIN_EMAIL`/
      `AURORA_ADMIN_PASSWORD` no `.env.local`. Novo describe em `admin-settings.spec.ts` entra
      logado como Aurora e confere 1 "Delegada" + 5 "Não delegada", o marcador vazado e a
      ausência de controle no bloco — o estado que antes só existia no código agora roda de
      verdade
- [x] 4.4 e2e: visitante sem sessão que abre `/admin/configuracoes` por URL direta é mandado ao
      login com `next` correto.
      **Desvio:** "usuário autenticado sem `content.edit`" não é testável hoje — `admin` e
      `staff` têm os dois a permissão, então não existe conta que a checagem recuse. A guarda
      está no servidor e vale para o primeiro papel que chegar sem ela
- [x] 4.5 `pnpm biome check`, `pnpm typecheck`, `pnpm test` (115 testes), `pnpm build` e
      `pnpm check:tokens` passam; tela conferida contra o design em 1440 de largura, sem erro de
      console e sem erro de hidratação

## 5. Correções encontradas durante a implementação

- [x] 5.1 `<form>` do "Sair" estava dentro de um `<p>` na sidebar — HTML inválido, erro de
      hidratação em toda tela do painel. Achado pelo console do navegador, não pelos testes
- [x] 5.2 `e2e/admin-login.spec.ts` apagava **todas** as sessões da conta semeada para simular
      revogação, derrubando a sessão de qualquer outro arquivo de teste rodando em paralelo com
      o mesmo usuário. Passou a apagar só a sessão da própria página, pelo token do cookie
- [x] 5.3 `e2e/admin-settings.spec.ts` roda em modo serial: todos os testes do arquivo escrevem
      e limpam a mesma linha de override da serventia piloto
- [x] 5.4 Interruptor de atribuição trocado por estado declarado. Levantou-se a hipótese de
      tornar a atribuição editável de verdade (override em `tenant_content`, intersecção com a
      delegação, aviso do que sai do ar); foi implementada e **revertida** por decisão do dono do
      projeto: atribuição é ato de delegação do tribunal, não preferência de tela. Continua
      config-as-code, alterada por commit revisado. O que ficou foi só a correção da affordance
- [x] 5.5 Tela alinhada à revisão do design no Claude Design (arquivo cresceu de 85,8 KB para
      118,6 KB entre a leitura inicial e esta): tique em círculo preenchido, marcador vazado para
      a não delegada, rótulo "Delegada"/"Não delegada" e a nota de volta para baixo da lista.
      **Desvio:** "Identidade Visual" no fim da nota é texto, não link — a aba não existe ainda,
      mesma regra da navegação e do "Trocar senha"
