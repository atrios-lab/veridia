## Context

O painel administrativo não tem hoje nenhum mecanismo de notificação transitória. Cada tela que
precisa confirmar uma gravação resolve isso do seu próprio jeito: a aba Identidade Visual usa um
`<output>` inline que permanece na tela até a próxima gravação (e ficava obsoleto depois de
edições não salvas, bug já corrigido separadamente rastreando uma assinatura dos valores). Essa
mudança introduz o primeiro toast do projeto e o aplica nessa mesma tela, como caso real.

O painel é multi-tenant: cada serventia publica um dos cinco estilos (`verde-dourado`,
`marinho-bronze`, `vinho-perola`, `grafite-cobre`, `oliva-terracota`), e o painel herda essa
paleta via `data-theme` no layout raiz. Qualquer elemento visual novo — toast incluso — precisa
usar os tokens `admin-*` de `@theme`, nunca cor fixa, para não destoar em algum dos cinco estilos.

## Goals / Non-Goals

**Goals:**
- Padronizar como o painel confirma uma ação transitória de sucesso/erro, com um componente que
  já resolve sozinho o problema de "confirmação que sobrevive ao estado que confirmava".
- Aplicar esse padrão na aba Identidade Visual, removendo o workaround de assinatura.
- Manter o toast coerente com os cinco estilos de marca via tokens `admin-*` existentes.

**Non-Goals:**
- Migrar os demais banners/`<output>` do painel ou do site público nesta mudança.
- Cobrir fluxos que terminam em redirect de página inteira (ex.: login, `redefinir-senha`) — um
  toast disparado imediatamente antes de uma navegação de documento inteiro nunca chega a
  aparecer, então esses fluxos continuam com banner fixo por enquanto.
- Adicionar toast ao site público (cidadão).

## Decisions

### Biblioteca: `sonner`

`sonner` foi a opção já indicada numa auditoria de UX anterior deste mesmo projeto (ver relatório
da tela de login) como a escolha natural para Next.js quando não existe nenhum sistema de toast.
Alternativa considerada: `react-hot-toast` — funcionalmente equivalente, mas `sonner` tem API mais
enxuta (`toast.success(...)` / `toast.error(...)`, sem precisar de hook por componente) e suporte
nativo a customização via CSS variables, que é o que a Decisão seguinte precisa.

Alternativa descartada: construir um toast próprio. Não há necessidade — nenhum requisito de
comportamento aqui foge do que uma biblioteca madura já cobre (fila, empilhamento, dismiss por
tempo, `aria-live`), e o princípio do projeto é "customização, nunca fork/reinvenção" aplicado
aqui a não reinventar infraestrutura de UI que já existe pronta.

### Onde montar o `<Toaster />`

Montado uma vez em `src/app/admin/layout.tsx` (layout raiz do admin, acima de `login` e do grupo
`(dashboard)`), não em `(dashboard)/layout.tsx`. Isso deixa qualquer tela futura do admin —
incluindo login, que hoje está fora do grupo `(dashboard)` — livre para disparar toast sem mover o
provider depois. Custo de montar mais cedo é zero: `<Toaster />` sem nenhum toast ativo não
renderiza nada visível.

### Aparência: reaproveitar os tokens `admin-*` já usados no banner que está saindo

O `<output>` "Publicado." atual usa `bg-admin-success-bg` / `text-admin-success-text`; o banner de
erro do mesmo formulário usa `bg-admin-error-bg` / `text-admin-error-text`. O toast de sucesso e
erro reaproveita exatamente esses tokens (via `toastOptions.classNames` do `sonner`, que aceita
classes Tailwind por variante), em vez dos tokens verde/vermelho fixos que o `sonner` usa por
padrão. Resultado: o toast já nasce coerente com os cinco estilos, sem trabalho extra por tema.

### Como a tela dispara o toast

A troca é local ao `visual-identity-form.tsx`: o `useEffect` que hoje roda em
`state.status === "saved"` para gravar `publishedSignature` passa a chamar `toast.success(...)` no
lugar (mesma dependência `[state]`, mesmo motivo de disparar uma vez por gravação bem-sucedida, já
que `useActionState` produz uma nova referência de `state` a cada submissão resolvida). O selo
`<output>`, `showPublished`, `formSignature` e `publishedSignature` são removidos: o toast não
precisa saber se o formulário mudou depois, porque ele já não estará mais na tela quando isso
acontecer.

## Risks / Trade-offs

- [Toast disparado logo antes de um redirect de página inteira nunca aparece] → Mitigado por
  escopo: esta mudança não toca nenhum fluxo que redireciona a navegação inteira (login,
  `redefinir-senha`). Migrar esses fica para uma mudança futura que resolva isso explicitamente
  (ex.: toast lido via query param após o redirect, como o padrão de banners que já existe lá).
- [Posição padrão do toast pode colidir com algum elemento fixo do admin] → Nenhum elemento fixo
  conhecido no shell do admin hoje (o widget de chat fixo é exclusivo do site público). Verificar
  visualmente durante a implementação; ajustar `position` do `<Toaster />` se necessário.
- [Nova dependência de terceiro] → `sonner` é amplamente usado no ecossistema Next.js, mantido
  ativamente, sem dependências pesadas.

## Migration Plan

Mudança puramente aditiva, sem dado a migrar: adicionar a dependência, montar o provider, trocar a
UI de confirmação de uma tela. Rollback é reverter o commit — nenhum estado persistido depende do
toast.
