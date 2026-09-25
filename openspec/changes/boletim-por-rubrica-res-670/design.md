## Context

O boletim mensal nasceu na `add-transparency-module` com quatro valores digitados (atos,
arrecadação bruta, tributos pagos, despesas) e um saldo calculado no núcleo
(`bulletinBalanceCents`). A tabela `transparency_bulletins` tem uma linha por serventia e mês,
garantida por índice único, e publicar de novo o mesmo mês é um upsert.

A Res. CNJ 670/2025 pede outra coisa: a parcela pública discriminada por rubrica, e a parcela
privada fora do site. A tabela de emolumentos do RN já divide cada ato em colunas: Emolumentos
(parcela do delegatário), FDJ, FRMP, FCRCPN, ISS e FUNAF. É dessas colunas que sai o boletim novo.

Nenhuma serventia publicou boletim em produção. As 13 serventias atendidas são do RN. O tenant não
tem hoje UF nem nome de cidade para exibição: `municipality` existe, mas é o campo "Merchant City"
do Pix, em caixa alta, sem acento e limitado a 15 caracteres ("SAO JOSE DE MIP" não serve para
exibir).

## Goals / Non-Goals

**Goals:**

- Boletim com um valor por fundo, agrupado nas rubricas do CNJ por um mapa por UF no núcleo.
- ISS numa linha própria, com o nome do município.
- Nada da parcela privada no site: sem arrecadação bruta, despesas nem saldo.
- Uma reclassificação da CGJ (§ 3º-C) resolvida mudando o mapa, sem migração de banco.

**Non-Goals:** ver "Não-objetivos" na proposta.

## Decisions

### Os valores dos fundos numa coluna jsonb, não numa tabela filha nem em colunas fixas

`transparency_bulletins` ganha `fund_amounts_cents jsonb` (por exemplo
`{"fdj": 123456, "frmp": 32100, "fcrcpn": 21040, "funaf": 9810}`) e `iss_cents bigint`.

- **Colunas fixas** (`fdj_cents`, `frmp_cents`...) prendem o schema ao RN. Uma serventia de outra
  UF, ou um fundo novo, viraria migração.
- **Tabela filha** (`bulletin_id`, `fund_key`, `amount_cents`) é o modelo mais "correto", mas
  transforma o upsert de uma linha em transação com apagar e inserir, e mais um join na leitura,
  para quatro números que sempre andam juntos.
- **jsonb** mantém uma linha por mês e o upsert como está. A validação fica no núcleo: um parser
  puro confere que as chaves são exatamente os fundos da UF e que cada valor é inteiro não
  negativo, antes de chegar ao banco. Valores em centavos cabem com folga no inteiro seguro do
  JavaScript (2^53).

### O banco guarda o fundo, não a rubrica

A linha grava `fdj: 123456`, nunca `II: 123456`. A rubrica vem do mapa na hora de exibir. Se a
CGJ-RN mudar a classificação de um fundo (§ 3º-C), todos os boletins, passados e futuros, passam a
aparecer com a classificação nova, que é a que vale na data da consulta. O valor recolhido a cada
fundo nunca muda; o que muda é a leitura.

Alternativa descartada: gravar a rubrica junto. Isso congelaria uma classificação que a própria
norma diz que a Corregedoria pode alterar, e exigiria migração de dados a cada orientação nova.

### Mapa de rubricas e fundos por UF no núcleo

`src/core/transparency/rubrics.ts`, puro:

```
RUBRICS     I  Emolumentos (parcela pública)
            II Fundo de Reaparelhamento da Justiça
            III Fundo de Compensação
            IV Outros Fundos Especiais

FUNDS_BY_STATE.RN = [
  { key: "fdj",    label: "FDJ",    rubric: "II"  },
  { key: "frmp",   label: "FRMP",   rubric: "IV"  },
  { key: "fcrcpn", label: "FCRCPN", rubric: "III" },
  { key: "funaf",  label: "FUNAF",  rubric: "IV"  },
]
```

Os nomes das rubricas são texto normativo, iguais para todo tenant, e ficam no núcleo, como
`MONTHS_PT` e `BULLETIN_STATUS_LABELS`. A ordem do array é a ordem das colunas da tabela do RN, e é
a ordem dos campos no formulário. Uma função pura `groupByRubric(state, amounts)` devolve as
rubricas com fundos, cada uma com subtotal e detalhe, mais o total. Rubrica sem fundo na UF não
aparece, o que hoje esconde a I no RN.

### Localização do tenant: `location: { city, state }`

Campo novo e obrigatório no `TenantSchema`: `city` com acento, para exibição ("São José de
Mipibu"), e `state` num enum de UF que hoje só aceita `"RN"`. O enum faz uma serventia de outro
estado falhar na validação da config até existir o mapa dela, em vez de publicar um boletim sem
fundos.

`municipality` continua como está, só para o Pix. Derivar a cidade de `municipality` ou de
`address` foi descartado: um é truncado e sem acento, o outro é texto livre e opcional.

### ISS digitado, fora das rubricas

`iss_cents` é um valor como os fundos, digitado a partir da guia municipal. Não passa pelo mapa e
não entra no total dos fundos. `issRate` não é usado: a alíquota serve para calcular custas de um
ato, e o boletim registra o que foi efetivamente recolhido no mês.

### "Despesas públicas" são os próprios recolhimentos

O § 3º fala em "receitas públicas" e "despesas públicas". No RN o dinheiro público entra na
serventia junto com o emolumento e sai como recolhimento a cada fundo. O boletim mostra o valor
recolhido no mês por fundo, que é as duas coisas ao mesmo tempo. Uma linha separada de "despesas
públicas" repetiria os mesmos números. Fica como pergunta aberta caso a CGJ-RN oriente diferente.

### Aviso da parcela privada na página, não no PDF

O aviso do § 3º-B é sobre o site, não sobre um mês. Fica fixo na seção do boletim em
`/transparencia`, visível mesmo sem boletins. O PDF leva só a citação da norma no rodapé.

## Risks / Trade-offs

- [Mapa do RN errado: FUNAF ou FRMP podem não ser "outros fundos especiais" na leitura da CGJ-RN,
  e pode existir parcela pública dentro dos emolumentos (rubrica I)] → O mapa é uma constante no
  núcleo e a rubrica não é gravada. Corrigir é mudar uma linha, e todos os boletins passam a
  aparecer certos.
- [jsonb aceita qualquer forma] → Toda gravação passa pelo parser do núcleo, que rejeita chave a
  mais, chave faltando e valor não inteiro. Leitura de linha malformada cai no mesmo parser e é
  tratada como erro, não como zero.
- [Remover colunas NOT NULL é migração destrutiva] → Expand e contract em dois deploys (abaixo).
- [O ISS pode ser lido como tributo do titular, e não como receita pública] → Decisão do produto
  (mostrar). Tirar depois é remover uma linha da exibição; o valor fica no banco.

## Migration Plan

A tabela está vazia em produção, mas a regra do projeto vale: migração destrutiva em dois deploys.

**Deploy 1: expand, nesta change**

1. Migração: adicionar `fund_amounts_cents jsonb NOT NULL DEFAULT '{}'` e
   `iss_cents bigint NOT NULL DEFAULT 0`; tirar o `NOT NULL` de `gross_revenue_cents`,
   `taxes_paid_cents` e `expenses_cents`.
2. O código novo grava e lê só as colunas novas.
3. Antes do merge: conferir que `transparency_bulletins` está vazia em produção e aplicar a
   migração à mão pelo `POSTGRES_URL_NON_POOLING` (a Vercel só roda `next build`). No Homolog,
   aplicar pelo pooler na porta 5432. Linhas de teste no Homolog, se houver, podem ser apagadas.

**Deploy 2: contract, em change própria depois do deploy 1 estar em produção**

4. Migração: `DROP COLUMN` de `gross_revenue_cents`, `taxes_paid_cents` e `expenses_cents`; tirar
   os `DEFAULT` das colunas novas.

**Rollback:** até o contract, voltar o código anterior funciona com o banco expandido, porque as
colunas antigas ainda existem. Um boletim publicado no formato novo não aparece no código antigo
(as colunas antigas ficam nulas). Isso só acontece se alguma serventia publicar no intervalo.

## Open Questions

- **Rubrica I no RN:** existe parcela pública dentro da coluna "Emolumentos" da tabela do RN? Hoje
  assumimos que não. A confirmar com a CGJ-RN ou com um contador de cartório.
- **FRMP e FUNAF em IV:** a CGJ-RN ainda não publicou orientação pelo § 3º-C.
- **Despesas públicas:** ficam cobertas pelos recolhimentos (ver decisão acima)?
- **FCRCPN nas serventias com registro civil:** o boletim mostra o recolhido ao fundo. O
  ressarcimento que a serventia recebe do FCRCPN pelos atos gratuitos é receita do delegatário e
  fica fora, mas vale confirmar.
