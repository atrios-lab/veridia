## Context

O módulo de adequação (change `add-compliance-intake`, já em produção) pergunta na Seção 1 a receita
bruta do último semestre. `classify()` lê esse número e devolve classe, subclasse e os prazos das
Etapas 1 e 2, pelos tetos do art. 16 do Provimento 213/2026 na redação do 243/2026.

A Átrios levantou, na prospecção, as 218 serventias do RN a partir da API pública do Justiça Aberta
(extração de 10/07/2026). O arquivo traz `receita_bruta_semestre_atual` e
`receita_bruta_semestre_anterior` por CNS, mais uma classe já calculada.

Duas verificações feitas sobre esse arquivo antes de escrever isto:

1. **A classe do arquivo bate com a do código nas 218 linhas, sem uma divergência.** Duas
   implementações independentes dos tetos do art. 16 chegaram ao mesmo lugar. É a melhor confirmação
   que a classificação teve até agora.
2. **As seis serventias atendidas estão todas na base**: Marinho (R$ 98.562,53), Bento Fernandes
   (R$ 182.221,45), Bom Jesus (R$ 250.348,82), Santa Cruz 2º Ofício (R$ 439.130,42), Major Sales
   (R$ 633.886,40) e Taipu (R$ 849.510,58).

O que o arquivo **não** resolve: o leiame diz, com todas as letras, que subclasse e prazo não foram
recalculados porque faltam os critérios de corte de cada subclasse. Quem montou a base olhou o
Provimento e não conseguiu determinar isso.

## Goals / Non-Goals

**Goals:**
- A titular confirma um número em vez de procurá-lo, e vê de onde ele veio e de quando.
- Ausência de declaração na origem se apresenta como ausência, nunca como zero.
- O erro que custa caro (atravessar a fronteira de classe) fica visível na hora.
- O caminho manual continua inteiro: o pré-preenchimento nunca é a única forma de chegar ao número.

**Non-Goals:** ver a proposta. Em especial: nada de consulta em tempo de execução ao CNJ, e a base de
prospecção não entra no repositório.

## Decisions

### 1. O dado entra como config por serventia, não como tabela de 218 linhas

`TenantSchema` ganha um `revenue` opcional:

```ts
revenue: z.object({
  semester: z.number().nonnegative(),
  previousSemester: z.number().nonnegative().optional(),
  /** De onde veio, para a nota na tela. Hoje só o Justiça Aberta. */
  source: z.literal("justica-aberta"),
  /** Data da extração, em ISO. É o que a tela mostra. */
  extractedOn: isoDate,
}).optional()
```

- **Por que por serventia**: é o padrão que o repositório já usa para tudo que descreve um cartório
  (nome, CNS, atribuições, DPO). Seis arquivos, seis diffs revisáveis, cada valor entrando com a data
  que o justifica.
- **Por que não a base inteira**: 218 linhas com nome, telefone e e-mail do responsável, das quais
  212 são de serventias que não atendemos. Não têm função na aplicação, e versionar dado pessoal de
  quem não é cliente numa empresa que vende adequação à LGPD é o tipo de coisa que a própria
  auditoria pegaria. A base de prospecção fica onde está, como ferramenta comercial.
- **Opcional**: uma serventia nova entra sem receita e o campo aparece vazio, como hoje. O
  pré-preenchimento é cortesia, nunca requisito.

### 2. Zero na origem é ausência, não valor

`prefillAnswers` só emite o campo quando o valor é maior que zero. Zero e ausente produzem o mesmo
resultado: campo vazio.

- **Por quê**: 62 das 218 serventias têm zero no semestre atual, e em pelo menos um caso conferido o
  semestre anterior tem valor (Almino Afonso: zero no atual, R$ 51.142,27 no anterior). A extração
  aconteceu em 10/07/2026, exatamente dentro da janela de declaração de julho (até o 10º dia útil),
  então parte da base foi lida antes de declarar.
- Zero é um número válido que atravessa toda a cadeia em silêncio: passa pelo `classify()`, produz
  "Classe 1, subclasse A" e o prazo mais longo, e chega ao documento assinado. Ausência não faz nada
  disso: o campo fica vazio, a seção fica "em andamento", e a classe só aparece quando houver número.
- O semestre anterior segue a mesma regra e é independente: pode vir preenchido com o atual vazio.

### 3. A tela diz de onde veio e de quando, e a serventia confirma

Sob cada um dos dois campos, quando o valor veio do pré-preenchimento:

> Veio do Justiça Aberta, extraído em 10/07/2026. Se você declarou ou corrigiu depois disso,
> ajuste aqui.

E quando a origem não tinha declaração para o período:

> O Justiça Aberta não tinha declaração sua para este semestre na extração de 10/07/2026.

- **Por que mostrar a data**: o número envelhece a cada janeiro e julho, e a extração pegou a janela
  de julho em movimento. Um pré-preenchido sem data é uma afirmação; com data, é uma oferta.
- A Seção 1 já é `prefilled: true` e já consta como "não iniciada" até a serventia abrir e avançar. O
  mecanismo de confirmação não muda.

### 4. Aviso de fronteira: função pura, mesmo molde das pendências

Em `classification.ts`:

```ts
classBoundary(revenue): { limit, distance, below, above } | null
```

Devolve algo só quando o valor está a menos de 10% de um teto (R$ 300.000 ou R$ 1.500.000). A tela
mostra na Seção 1, abaixo do campo, no mesmo desenho dos avisos que a Seção 8 já usa para o Windows
10:

> Este valor está a R$ 3.767 do limite entre a Classe 1 e a Classe 2. De um lado o prazo da Etapa 1
> é de 300 dias e o encarregado é opcional; do outro são 240 dias e a nomeação é obrigatória.
> Confira o valor declarado antes de assinar.

- **Por que 10%**: pega as oito serventias que a base mostra encostadas nos tetos sem alarmar as
  outras 210. É um número escolhido pelos dados, não pela teoria; se alarmar demais na prática,
  aperta.
- **Por que avisar e não bloquear**: quem declara é a serventia e quem assina é a titular. O papel do
  módulo é dizer o que está em jogo, do mesmo jeito que faz com Windows 10 e backup nunca testado.
- **Por que função pura em `classification.ts`**: é aritmética sobre os mesmos tetos que `classify()`
  já conhece, e a tela da serventia e a ficha da Átrios vão querer ler a mesma resposta.

### 5. O que a exportação leva

Nada de novo no JSON do gerador. `receita_semestre` e `receita_semestre_anterior` já saem de lá, e
continuam saindo do que está no campo. A origem e a data são contexto de tela, não conteúdo de
documento: o documento afirma o que a serventia declarou, não de onde nós tiramos a sugestão.

## Risks / Trade-offs

- **O número envelhece.** Cada janeiro e julho a base muda e o config fica velho. Mitigação: a data
  na tela, que transforma um dado velho em um dado datado. A atualização é PR de config, e cabe num
  ritual semestral da Átrios.
- **A extração de 10/07/2026 pegou a janela aberta.** Serventias que declararam entre 10/07 e a data
  em que responderem o módulo vão ver um número desatualizado com data explícita, que é exatamente o
  caso que a nota de confirmação atende.
- **Confirmar é mais fácil que conferir.** Um campo preenchido convida ao "próxima" sem leitura. É o
  preço do pré-preenchimento, e vale para os seis campos que já vêm preenchidos hoje. O aviso de
  fronteira existe justamente onde esse risco tem consequência.
- **A interpretação de "receita bruta" continua herdada.** O Justiça Aberta declara três linhas
  (emolumentos, terceiros legal, terceiros outros) e o valor da base é um total. Esta change adota a
  mesma interpretação que a prospecção usou. Se a Átrios concluir que o art. 16 pede outra coisa,
  muda a origem do dado, não o desenho.

## Open Questions

- **Os cortes de subclasse.** O código divide as Classes 1 e 2 em terços iguais e a Classe 3 em
  múltiplos de 3, 6 e 12, por leitura de fontes secundárias. Quem montou a base de prospecção não
  conseguiu determinar esses cortes no texto do Provimento. A classe está validada nas 218 linhas; a
  subclasse não está validada por nada. Conferir no texto compilado antes que qualquer documento
  assinado saia com uma subclasse impressa. Fora do escopo desta change, mas é a pendência mais
  antiga desta área.
