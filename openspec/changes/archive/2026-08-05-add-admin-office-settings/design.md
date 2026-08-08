## Context

O painel tem hoje uma tela de login estilizada (Entrega 5) e, atrás dela, um `(dashboard)` sem
estilo nenhum: um parágrafo com e-mail, papel e nome da serventia, e um botão "Sair". A guarda de
sessão e a autorização por papel e por serventia já existem e funcionam (`getSession`, `can`,
`canAccessTenant`); o que falta é tudo o que vem depois delas.

Ao mesmo tempo, `Tenant` é config-as-code puro: um objeto validado por Zod, resolvido por host,
sem nenhuma camada de override em cima. As tabelas `tenant_branding` e `tenant_content` foram
criadas na fundação da plataforma exatamente para essa camada e continuam vazias — nenhum código
lê nenhuma das duas ainda. Esta mudança é a primeira a usar `tenant_content`, e portanto é ela
que decide como a mescla funciona para todas as próximas.

Restrições que valem aqui: regra em núcleo puro sem I/O; nenhum hexadecimal fora de `@theme`
(`check:tokens` quebra o build); o painel é estética fixa da plataforma; e `resolveTenant` é
chamado no middleware, que roda no edge e não pode tocar o banco.

## Goals / Non-Goals

**Goals:**

- Casca do painel reutilizável por toda tela futura, com navegação que cresce por lista de dados.
- Camada de override de tenant com mescla pura, testável sem banco, e leitura barata o bastante
  para viver dentro de `getTenant()`.
- Aba Serventia completa: o editável grava e vale no site público; o estrutural aparece e não
  cede a requisição forjada.

**Non-Goals:**

- As outras três abas, a tela de Usuários e a de Trocar senha (proposta à parte).
- Tornar qualquer dado estrutural editável.
- Rascunho/publicação para contatos.

## Decisions

### 1. Override em `tenant_content`, chave `office-contact`, gravando direto em `published`

**Escolhido:** uma linha por serventia em `tenant_content`, `key = "office-contact"`, com o JSON
`{ openingHours, contacts: { phone, whatsapp, email } }` na coluna `published`. `draft` fica nulo.

**Por quê:** a tabela existe, tem índice único em `(tenant_slug, key)`, e é literalmente para
isto. Criar `tenant_settings` seria uma migração e uma segunda forma de dizer a mesma coisa.

**Sobre não usar `draft`:** telefone e horário são operacionais. A serventia que muda o número do
balcão precisa que o número novo esteja no ar agora, não depois de alguém publicar. O par
draft/published é para conteúdo editorial — que é a aba Identidade Visual, na parte 2.

**Alternativa descartada:** colunas dedicadas em uma tabela nova. Mais tipagem no banco, menos
flexibilidade quando as outras abas chegarem, e uma migração destrutiva à espreita.

### 2. Mescla pura no núcleo, leitura no transporte

`src/core/tenant/overrides.ts` exporta o schema do override e a função pura:

```ts
export const OfficeContactOverrideSchema = TenantSchema.pick({ openingHours: true, contacts: true }).partial()
export function applyTenantOverrides(tenant: Tenant, raw: unknown): Tenant
```

`applyTenantOverrides` faz `safeParse` do JSON vindo do banco e devolve o tenant com os campos
presentes sobrescritos. **JSON inválido ou corrompido devolve o tenant de configuração, sem
lançar** — um override malformado não pode derrubar o site público inteiro; ele é ruído em cima
de uma base que sempre é válida.

O schema do override deriva de `TenantSchema` por `.pick()` em vez de repetir os campos: uma
mudança em `contacts` no schema principal chega aqui sozinha, sem alguém lembrar.

`src/lib/tenant.ts` faz a consulta e chama a função. A mescla é testável com `node --test` sem
banco nenhum.

### 3. `getTenant()` cacheado por request, `resolveTenant()` intocado

`getTenant()` passa a ser envolvido em `cache()` do React. Os 18 arquivos que o chamam hoje
podem chamá-lo várias vezes no mesmo render (layout + página + action); sem `cache()` isso vira
N consultas por request em vez de uma.

`resolveTenant()` continua puro. O middleware segue usando ele: um override de telefone não muda
roteamento, e o edge não pode consultar o banco.

**Alternativa descartada:** expor `getTenantConfig()` (sem override) e `getTenant()` (com) para
os chamadores escolherem. Duas funções quase iguais é como se ganha o bug de mostrar o telefone
antigo em uma tela só. Uma função, sempre com override.

### 4. Navegação como lista de dados, filtrada por existência e por permissão

A sidebar renderiza a partir de um array em `src/app/admin/_components/nav.ts`, cada item com
`{ group, label, href, icon, permission? }`. Só entram itens de rotas que existem; cada entrega
futura acrescenta a sua. O item é omitido se `can(role, item.permission)` for falso — omissão que
é cortesia, não segurança: a rota checa de novo.

Os ícones entram como novos nomes em `AdminIcon`, seguindo o componente que já existe.

### 5. Abas: uma URL, `searchParams` mais tarde

A faixa de abas é renderizada pela página; a Serventia é a única com conteúdo. As outras três são
`<span aria-disabled="true">` com título "Em breve" — não são `<button disabled>` porque não são
controles, e não são links porque não levam a lugar nenhum.

Quando a segunda aba existir, elas viram links para `?aba=identidade-visual` — server-rendered,
sem estado de cliente. Não vale antecipar isso agora.

### 6. Server action com `useActionState`, no padrão que o repositório já usa

`saveOfficeContact` em `configuracoes/actions.ts`: checa sessão, checa `content.edit` e a
serventia da sessão, faz `parse` do `FormData` **apenas com `OfficeContactOverrideSchema`
exigindo os quatro campos** (é o `.pick()` sem `.partial()`), grava por upsert em
`tenant_content` com `onConflictDoUpdate`, chama `recordAudit` com ação
`"office-settings.save"`, e faz `revalidatePath("/", "layout")` para o site público pegar o
valor novo.

Campos fora do schema no `FormData` são ignorados por construção — é o que atende o cenário de
requisição forjada, sem código defensivo extra.

### 7. Switches travados são apresentação, não formulário

Os seis cartões de atribuição não são `<input type="checkbox" disabled>`: são `<div>` com o
desenho do switch e `aria-disabled`, mais texto que diz "não ativa" no desligado. Checkbox
desabilitado convida ao clique e some do foco do teclado sem explicar por quê; texto explícito
sobrevive a leitor de tela e a captura de tela colada no WhatsApp do suporte.

## Risks / Trade-offs

- **Uma consulta a mais em quase todo request** → `cache()` por request, consulta de uma linha
  por índice único, e o resultado é pequeno. Se virar problema medido (não suposto), a saída é
  cachear por slug com `unstable_cache` e invalidar na gravação.
- **Banco fora do ar derruba página que antes só dependia de arquivo** → a leitura do override é
  envolvida em try/catch e, na falha, devolve a configuração em código. O site público continua
  de pé com os dados de arquivo; só a edição fica indisponível.
- **Frase de horário e janela numérica de agendamento podem divergir** → assumido e documentado:
  a serventia pode salvar "das 8h às 18h" enquanto as faixas de agendamento param às 14h. Não é
  bug silencioso porque está escrito aqui e nos não-objetivos da proposta; a parte 2 decide se
  une os dois campos ou se avisa na tela.
- **Sidebar divergindo do design enquanto as telas não existem** → deliberado. Item de menu que
  leva a 404 gasta mais confiança do que sidebar curta.
- **`revalidatePath("/", "layout")` é uma marreta** → é, e é a certa por ora: horário e contato
  aparecem no layout público, na home e na página de contato. Refinar sem medir seria adivinhar.

## Migration Plan

Nenhuma migração de banco. As tabelas usadas já existem e estão vazias; ausência de linha é o
estado válido e significa "use a configuração". Rollback é reverter o código: as linhas gravadas
ficam órfãs e inertes, sem quebrar nada.

## Open Questions

- Salvar contato deveria exigir `content.publish` em vez de `content.edit`? Como o valor vai ao
  ar na hora, há argumento para restringir ao registrador. Esta mudança fica em `content.edit`
  (staff também atende telefone) e a decisão pode ser revista sem alterar o schema.
- As iniciais do rodapé saem do nome do usuário. Não há campo `name` garantido em toda conta
  criada por convite; a implementação cai para as duas primeiras letras do e-mail quando faltar.
