# Briefing de front — tela de sucesso do pedido lançado no balcão

Contexto para redesenhar **uma tela só**: o que o operador vê logo depois de registrar um pedido
presencial no painel. A implementação atual funciona mas o desenho não agradou; o back-end,
as rotas e os PDFs estão prontos e não mudam.

---

## 1. O que é essa tela

O balcão atende presencialmente, preenche um formulário no painel e registra o pedido. No
instante em que o pedido nasce, o sistema gera duas coisas: o **protocolo** (`REQ.2026.000139`) e
a **chave de acesso** (`776N-H532-W9VD`). Com esse par, o cidadão acompanha o pedido depois, pelo
site, sem ter conta nenhuma.

A tela é o que aparece no lugar do formulário depois do envio. Ela precisa resolver três coisas,
com o cidadão em pé do outro lado do balcão:

1. **Confirmar** que o pedido certo foi lançado (a pessoa certa, o serviço certo).
2. **Entregar** protocolo e chave — impressos, copiados, ou lidos em voz alta.
3. **Não desperdiçar** o único momento em que a chave existe em texto claro (ver §4).

### Onde vive

| | |
|---|---|
| Rota | `/admin/pedidos/novo` |
| Arquivo | `src/app/admin/(dashboard)/pedidos/novo/manual-entry-form.tsx` |
| Componente | `SuccessScreen` (no fim do arquivo) |
| Largura do container | `max-w-[760px]`, dentro da casca do painel (sidebar de 236px à esquerda) |
| Uso | Desktop. É o computador do balcão, mouse e teclado. Sem caso de uso mobile real. |

### O fluxo completo

```
   ┌─────────────────────────────────────────────────────────┐
   │  /admin/pedidos/novo                                     │
   │  formulário: atribuição → ato → dados do requerente      │
   └──────────────────────────┬──────────────────────────────┘
                              │  "Registrar pedido"
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  ► ESTA TELA ◄   (substitui o formulário, mesma rota)    │
   │                                                          │
   │  protocolo + chave em claro ── existem só aqui           │
   │       │                                                  │
   │       ├──► imprimir requerimento   (GET  → PDF)          │
   │       ├──► imprimir comprovante    (POST → PDF)          │
   │       ├──► copiar os dois          (clipboard)           │
   │       └──► voltar à fila           (/admin/pedidos)      │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼  sair / recarregar
   ┌─────────────────────────────────────────────────────────┐
   │  a chave some para sempre. o banco só guarda o hash.     │
   │  reimprimir o comprovante exige emitir uma chave nova,   │
   │  o que invalida a que o cidadão levou.                   │
   └─────────────────────────────────────────────────────────┘
```

---

## 2. Os dois documentos

São **dois PDFs diferentes**, com propósitos opostos. Isso não é detalhe de implementação, é o
que a tela precisa comunicar:

| | **Requerimento** | **Comprovante de acesso** |
|---|---|---|
| Para quê | O cidadão assina, fica na serventia | O cidadão leva embora |
| Contém a chave? | **Nunca** | **Sim, é o conteúdo dele** |
| Como se pede | `GET .../imprimir` | `POST .../imprimir` com `chave` no corpo |
| Por que assim | Só precisa da sessão do operador | A chave em claro tem que ser enviada de volta: o servidor não a tem |
| Reimprimível depois? | Sim, sempre | **Não.** Só enquanto esta tela está aberta |

O motivo do requerimento não carregar a chave: ele é assinado (às vezes digitalmente, no Gov.br) e
devolvido à serventia. Um documento que vai ser assinado e devolvido não pode conter a credencial
de acesso do próprio cidadão.

**Consequência de design:** os dois botões não são irmãos simétricos. Um é rotina, o outro é
irreversível. Vale considerar se devem ter o mesmo peso visual — hoje têm.

---

## 3. Contrato de dados — leia antes de desenhar

Esta é a parte que mais importa. A arte de referência anterior mostrava campos que **não existem
em lugar nenhum do sistema**, e desenhar em cima deles gera um layout que não pode ser construído.

### Disponível agora, sem tocar em back-end

```ts
{
  protocolNumber: string   // "REQ.2026.000139"
  accessKey:      string   // "776N-H532-W9VD"
  applicantName:  string   // "Maria Aparecida da Silva"
  actName:        string   // "Certidão de nascimento"
}
```

### Barato de adicionar (o formulário já coleta, só não repassa)

| Campo | Tipo | Observação |
|---|---|---|
| `contact` | string | E-mail **ou** telefone, um campo só |
| `cpf` | string? | Opcional. Existe máscara pronta (`maskCpf`) |
| `description` | string? | "Observações" do atendimento |
| `purpose` | string? | Só alguns atos podem pedir finalidade (lei proíbe em certidões) |
| `amountCents` | number? | Opcional. Formatador pronto (`formatCents`) |
| `attribution` | enum | `RCPN`, `NOTAS`, `RI`, `PROTESTO`, `RTD`, `RCPJ` |
| `act.documents` | string[]? | Lista de papéis **esperados** para o ato |
| `act.guidance` | string? | Orientação do ato, quando existe |
| `createdAt` | Date | Data/hora do registro |

### **Não existe.** Não desenhe.

| Campo | Situação |
|---|---|
| Endereço do requerente | Não é coletado em lugar nenhum |
| Checklist "documentos **apresentados**" | Existe a lista de esperados (`act.documents`), mas ninguém marca o que foi entregue. Não há esse dado. |
| Prazo estimado / data de entrega | Não existe. Nenhum ato tem prazo modelado. |
| Forma de retirada ("no balcão, das 8h às 16h") | Não existe como dado do pedido |
| Situação do pagamento ("isento", "nada a pagar") | Existe valor, **não** existe status de pagamento |
| RG / documento apresentado | Não é coletado |
| Canhoto de protocolo de entrega | Isso é layout de PDF, não desta tela |

> Se algum desses for essencial ao desenho, é uma conversa de produto antes de front: significa
> coletar dado novo no formulário e migrar banco.

---

## 4. Restrições duras

Não são preferências. Quebrar qualquer uma quebra o produto.

**A chave existe uma vez só.** O banco guarda apenas o hash. Ela está em memória no navegador
enquanto esta tela vive, e some no primeiro reload. A tela é a última chance de imprimir o
comprovante. Se o operador sair sem imprimir, a única saída é emitir uma chave nova — o que
invalida a que o cidadão eventualmente já anotou.

**Não há pré-visualização de PDF.** Decisão registrada na proposta. O PDF abre em aba nova com
`Content-Disposition: inline`, e a própria aba do navegador é a pré-visualização. Renderizar o
documento dentro da tela é caro e não muda o que o operador faz (imprimir).

**Os PDFs não mudam.** `buildRequerimento` e `buildAccessReceipt` estão fechados neste escopo. O
que sai da impressora é o que o código já produz hoje.

**O comprovante precisa de um POST com a chave no corpo.** Não pode ser link. Uma chave em query
string entra no histórico do navegador e nos logs. Na prática: um `<form method="post">` com
`<input type="hidden" name="chave">`, ou um `fetch` que baixa o blob.

**Toda impressão é auditada.** Já implementado no servidor, transparente para o front — mas
significa que "imprimir" não é uma ação gratuita: cada clique vira uma linha em `audit_log` com
quem imprimiu e quando.

**Sem cor fora de token.** Um script de CI (`pnpm check:tokens`) reprova qualquer hex literal fora
do bloco `@theme`.

---

## 5. Design system

Referência completa: `docs/design-system.md`. O essencial:

### Botões — três partes, sempre nessa ordem

```tsx
<button className="btn btn-admin-primary btn-md">Salvar</button>
```

| Variante | Quando |
|---|---|
| `btn-admin-primary` | Ação principal. **Uma por tela.** |
| `btn-admin-secondary` | Alternativa, voltar, cancelar |
| `btn-admin-ghost` | Ação em texto, sem caixa |
| `btn-admin-danger` | Destrutiva |

Tamanhos: `btn-sm` (linha densa) · `btn-md` (padrão do painel) · `btn-lg` (submit de formulário).

Classes de **layout** depois (`flex-1`, `mt-3`, `w-full`) são livres. Classes de **aparência** em
botão (`rounded-*`, `bg-*`, `px-*`, `text-[13px]`) não — se precisou, ou é variante nova no
design system, ou não é um botão.

### Tokens de cor (`--color-admin-*`, usados como `bg-admin-card`, `text-admin-muted`…)

```
primary · primary-soft · accent · on-dark-accent
surface · card · card-surface · border · active-border
input-bg · input-border · readonly-bg
text · muted · faint
error-bg · error-text · error-border
warning-bg · warning-text
success-bg · success-text
```

Eles resolvem para o tema da serventia (`--brand-*`): **cada cartório pinta o painel com a
própria paleta**. São cinco temas possíveis. Não assuma verde — o mesmo layout aparece em vinho,
marinho, grafite e oliva. Cores de estado (erro/aviso/sucesso) são fixas em todos.

### Outros

| | |
|---|---|
| Fonte | `font-serif` para títulos, sans no resto |
| Raio | `--radius-control` (10px) em botões. Cards no painel usam `rounded-[14px]` |
| Ícones | `<AdminIcon name="..." />` — disponíveis: `check`, `checkCircle`, `clock`, `file`, `inbox`, `mail`, `plus`, `x`, `lock`, `upload`, `eye`, `search`, `settings`, `users`, `shield`, `globe`, `chat`, `calendar`, `megaphone`, `grid`, `chevronDown` |

> Não existe ícone de impressora. Precisa ser adicionado ao `PATHS` em
> `src/app/admin/_components/icon.tsx` (é uma lista de paths SVG, 1–3 strings por ícone).

---

## 6. O que existe hoje

Estrutura atual, em ordem vertical:

```
┌───────────────────────────────────────────────────────┐
│ Pedido registrado                        (serif, 17px)│
│ Certidão de nascimento · Maria Aparecida da Silva     │
│ Protocolo e chave de acesso, mostrados só agora:      │
│                                                        │
│ ┌──────────────┐ ┌──────────────┐  [Copiar os dois]   │
│ │REQ.2026.000139│ │776N-H532-W9VD│                     │
│ └──────────────┘ └──────────────┘                     │
│                                                        │
│ [Imprimir requerimento] [Imprimir comprovante]         │
│ [Imprimir os dois]                                     │
│                                                        │
│ Voltar à fila                                          │
└───────────────────────────────────────────────────────┘
```

Problemas conhecidos do desenho atual, para não repetir:

- **Três botões de impressão lado a lado, mesmo peso.** O operador tem que ler os três para
  decidir. Na prática quase sempre quer os dois.
- **Nada distingue os dois documentos.** Quem não conhece o sistema não sabe que um fica e o
  outro vai embora, nem que um é irreversível.
- **Nenhum aviso sobre a chave sumir.** A restrição mais importante da tela é invisível nela.
- **Hierarquia achatada.** Protocolo e chave têm o mesmo tratamento visual, sendo que o protocolo
  é público e a chave é credencial.
- **`btn-sm` nos botões de impressão.** Densidade de tabela numa tela que tem uma ação só.

---

## 7. O que está livre

Layout, hierarquia, agrupamento, densidade, uso de cor, ilustração de estado, microcopy — tudo.
As únicas amarras são §3 (dados que existem), §4 (restrições) e §5 (design system).

Perguntas em aberto que o desenho pode responder:

- "Imprimir os dois" deve ser a ação primária e as individuais secundárias/escondidas?
- Vale um aviso explícito de que a chave não volta? Onde, sem virar ruído?
- A chave merece tratamento visual de credencial (monoespaçada, moldura diferente, ícone de
  cadeado) em vez de parecer um segundo protocolo?
- Copiar deve ser um botão por campo, ou o "copiar os dois" atual basta?
- O que fica na tela depois de imprimir — muda alguma coisa, ou o estado é sempre o mesmo?
- Vale mostrar mais do pedido (contato, CPF, valor) para o operador conferir antes de despachar?
