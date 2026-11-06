## Context

O CPF do pedido de serviço é opcional e está em `commonFields`
(`src/core/request/form.ts`), compartilhado pelo site (`publicServiceRequestSchema`) e pelo balcão
(`serviceRequestSchema`). A correção de dados (`requestDataEditSchema`, `src/core/request/edit.ts`)
trata o CPF vazio como resposta válida e o apaga.

A identificação hoje:

| Canal | E-mail | CPF |
|---|---|---|
| Site | obrigatório | opcional |
| Balcão | e-mail ou telefone | opcional |
| Correção de dados | contato com mínimo de 3 caracteres | opcional, pode apagar |
| Agendamento e LGPD | obrigatório | opcional |
| Ouvidoria | contato opcional | não pede |

A coluna `cpf` aceita nulo porque a tabela guarda outros tipos de registro e pedidos antigos. A
regra de obrigatoriedade por tipo já é do núcleo.

## Goals / Non-Goals

**Goals:**

- Todo pedido novo pelo site ter CPF válido.
- Todo pedido novo pelo balcão ter CPF válido ou, como exceção registrada, outro documento.
- Impedir que a correção de dados apague a identificação já gravada.
- Manter corrigíveis os pedidos antigos sem CPF.

**Non-Goals:**

- Os listados em "Não-objetivos" da proposta: e-mail no balcão, outros canais, gratuidade,
  preenchimento retroativo, busca pelo outro documento e recuperação de chave.

## Decisions

### A regra vale para todas as serventias

A exigência partiu de uma serventia, e o responsável pelo produto decidiu aplicá-la a todos os
tenants. Por isso não há configuração: a regra é a mesma no núcleo, para qualquer serventia.

Alternativa: uma opção por tenant, desligada por padrão, como `requestDeadlineDays` e
`publishBulletinPrivateFigures`. Descartada por decisão do responsável pelo produto. Se outra
serventia recusar a regra, essa opção é o caminho e os schemas passam a receber a configuração.

### A regra fica em cada schema, não em `commonFields`

`cpf` sai de `commonFields`. O site declara um CPF obrigatório; o balcão declara o CPF junto com a
marcação e o documento, com a regra num refinamento próprio. O CPF vazio passa a gerar "Informe o
CPF." e o inválido segue com "CPF inválido.".

Alternativa: um parâmetro de canal em `actRules`, como já existe para as testemunhas. Descartada:
o tipo de `PublicServiceRequestInput.cpf` continuaria opcional, e o compilador não ajudaria a
encontrar os pontos que tratam o CPF como ausente no site.

### Exceção só no balcão

Quem não tem CPF é atendido no balcão, onde um operador vê o documento. No site a exceção seria uma
marcação que qualquer pessoa usa para pular o campo, e `isValidCpf` não detecta um número válido de
outra pessoa, então ela não acrescentaria garantia nenhuma.

### Outro documento em `details`, sem migração

O documento fica em `details.alternateDocument`, como `{ type, number }`, validado por
`serviceRequestDetailsSchema` (`src/core/request/kinds.ts`) e lido por um helper como `readPhone`.
A lista de tipos é fechada e pequena (RG, RNE, passaporte, outro), para o requerimento sair legível.
O número é texto livre curto, sem validação de formato, porque cada documento e cada estado têm o
seu.

Alternativa: colunas novas. Descartada: é dado de uma exceção rara, de um tipo só de registro, e o
padrão da tabela para isso é `details`. Também evita a migração manual de produção.

Consequência: o documento não entra na busca por CPF do painel, que lê a coluna. Isso foi aceito na
proposta como não-objetivo.

### A máscara segue a do CPF

O motivo de `maskCpf` vale aqui: o operador não precisa do número inteiro na tela. O detalhe mostra o
tipo e só os dois últimos caracteres do número, e o requerimento, que já traz o CPF completo, traz o
documento completo. O formulário de correção mostra o valor inteiro, igual faz com o CPF.

### A correção decide pelo que está gravado

`requestDataEditSchema` só enxerga o envio, e a regra precisa comparar com o pedido gravado. Ela vira
uma função pura do núcleo, `resolveIdentityEdit(stored, input)`, ao lado de `resolveVariantEdit`:

```
CPF válido enviado                      → grava CPF, remove outro documento
exceção marcada, com documento          → remove CPF, grava outro documento
exceção marcada, sem documento          → recusa
vazio, e havia CPF ou documento gravado → recusa
vazio, e não havia nenhum               → segue sem identificação (pedido antigo)
```

`updateRequestDataWith` hoje funde `details` com `||`, que não remove chaves. Remover o documento
exige tirar a chave explicitamente, e a persistência precisa de teste próprio contra PGlite.

O contato não muda: a correção já recusa contato vazio.

### Pedido vindo de conversa segue a regra do balcão

O lançamento a partir do atendimento por chat usa o mesmo formulário e passa a exigir o mesmo. O
operador pergunta o CPF na conversa antes de lançar.

### Checagem de duplicidade não muda

`findOpenServiceRequestDuplicateWith` continua comparando CPF ou e-mail, porque os pedidos antigos
sem CPF ainda precisam casar pelo e-mail. A assinatura mantém `cpf` opcional; só o comentário que
trata o CPF como opcional no formulário é atualizado.

## Risks / Trade-offs

- **Queda de pedidos no site** → quem não tem CPF ou não quer informar desiste do pedido online. A
  orientação junto ao campo aponta o balcão, e vale acompanhar o volume após o deploy.
- **CPF de outra pessoa ou gerado** → a validação só confere os dígitos. Sem consulta à Receita, a
  regra melhora o preenchimento, mas não prova identidade. Fica fora desta mudança.
- **Operador usar a exceção para ganhar tempo** → exigir tipo e número dá atrito, e o documento fica
  visível no pedido. Sem relatório nesta mudança.
- **Regra pedida por uma serventia e aplicada a todas** → cada serventia é controladora dos próprios
  dados e passa a coletar um dado que não pediu. As demais precisam ser avisadas antes do deploy, e a
  finalidade registrada precisa valer para elas também.
- **Mais dado pessoal coletado** → o CPF passa a ser coletado de todos os solicitantes, o que amplia
  o impacto de um vazamento. A justificativa em aberto abaixo precisa existir antes do deploy.
- **Política de privacidade defasada** → `/privacidade` lista "nome, contato e os documentos" para o
  pedido, sem citar o CPF. O texto é atualizado nesta mudança, e passa por revisão jurídica se for o
  procedimento da serventia.
- **Testes e seeds sem CPF** → os testes que montam pedidos sem CPF no site quebram. Isso é esperado
  e está nas tarefas.

## Migration Plan

Sem migração de banco, então o deploy não tem a etapa manual em produção. A mudança vale para os
envios a partir do deploy. Um formulário aberto no momento do deploy recebe o erro de campo do
servidor, sem perder o restante do preenchimento. Para reverter, basta reverter o código: pedidos com
`details.alternateDocument` continuam legíveis se o schema mantiver a chave como opcional.

## Open Questions

- **Para que a serventia usa o CPF (LGPD art. 6º, III)?** Respondido em 06/11/2026 por Joelison
  Marinho, do Cartório Ielmo Marinho: "Para qualificar conforme lei 6.015". `/privacidade` registra
  essa finalidade. A decisão anterior, no agendamento, segue valendo: lá o CPF continua opcional.
- **Existe exigência legal ou da corregedoria por trás?** A serventia citou a Lei 6.015 sem indicar
  o artigo, e o projeto não conferiu qual dispositivo exige o CPF do requerente. Ainda em aberto:
  essa lei trata dos registros públicos e não alcança, por si, os pedidos de notas e de protesto. As
  demais serventias também não confirmaram a finalidade.
- **Pedido de gratuidade pelo site deve exigir CPF de quem declara hipossuficiência?** Hoje a regra
  vale para todo ato, com o balcão como saída. Vale confirmar com a revisão jurídica à luz do
  Provimento CGJ/TJRN n. 7/2026.
