## Context

O selo e o prazo pertencem ao ato (`processingMode`, `legalDeadlineDays`) e aparecem na etapa 2 do pedido. A opção do ato (`variants`) só é escolhida na etapa 3 e não muda nenhum dos dois.

Hoje:

- `ri-certidao-matricula` oferece matrícula, inteiro teor e ônus, com selo "Termina on-line" e prazo de 1 dia.
- `rcpn-certidao` oferece nascimento, casamento, óbito e outra. "Inteiro teor" só aparece como tipo de certidão na gratuidade.
- `requiresPurpose` é um booleano do ato, e um teste trava que só dois atos de imóveis pedem finalidade.
- `details` é jsonb validado por `serviceRequestDetailsSchema`, e guarda dados de um tipo só de pedido sem migração.
- O aviso de assinatura de próprio punho (`HANDWRITTEN_SIGNATURE_CAVEAT`) é único e cita Gov.br e e-Notariado.

Normas lidas:

| Norma | O que diz | Fonte |
|---|---|---|
| Lei 6.015, art. 17 | Certidão pode ser pedida sem informar motivo | Planalto |
| Lei 6.015, art. 18 | Certidão sai sem despacho judicial, salvo arts. 45, 57 § 7º e 95, parágrafo único | Planalto |
| Lei 6.015, art. 19, §§ 1º, 5º, 10 e 11 | Inteiro teor eletrônico, dispensa de materialização e prazos de imóveis | Planalto |
| CNN, art. 114 | Interessado, representante legal e mandatário com poderes especiais não dependem de autorização; terceiro com dado sensível depende | Texto compilado no site do CNJ, conferido em 07/11/2026 |
| CNN, art. 116 | Define dados sensíveis, restritos e sigilosos | Texto compilado no site do CNJ, conferido em 07/11/2026 |
| CNN, art. 117 | Assinaturas admitidas; o requerimento traz motivo, parentesco e se o registrado é falecido | Texto compilado no site do CNJ, conferido em 07/11/2026 |
| CNN, arts. 118 e 119 | Óbito sem requerimento nem autorização; restrição a dado sensível não alcança pessoa falecida | Texto compilado no site do CNJ, conferido em 07/11/2026 |
| Provimento 156/2016-CGJ/RN, arts. 52 e 53 | Papel de segurança obrigatório, com o nome oficial | Site de atos da CGJ/RN |
| Provimento 156/2016-CGJ/RN, arts. 496 e 497 | Certidão eletrônica com ICP-Brasil e cobrança própria da materialização | Site de atos da CGJ/RN |
| Provimento 156/2016-CGJ/RN, arts. 486 a 490 | Serventia de imóveis integra a Central Eletrônica da ANOREG/RN e atende os pedidos de certidão que chegam por ela | Site de atos da CGJ/RN |
| Provimento 004/2025-CGJ/RN | Desbloqueio de matrículas de enfiteuse registradas depois do Código Civil de 2002; não trata de certidão | Site de atos da CGJ/RN |

## Goals / Non-Goals

**Goals:**

- O cliente saber onde a certidão termina antes de preencher o pedido.
- O operador ver qual certidão foi pedida para informar o valor certo.
- O requerimento de inteiro teor do RCPN trazer o que o art. 117, § 3º, pede.
- Quem pede saber, antes de enviar, que o pedido passa por análise.

**Non-Goals:**

- Os listados em "Non-goals" da proposta.

## Decisions

### Um ato próprio para cada certidão nova

O papel de imóveis e o verbum ad verbum entram como atos, não como opções em "Qual certidão?". O selo e o prazo já são do ato, e o cliente lê os dois antes de escolher a opção. Como opção, o papel apareceria com "não precisa ir à serventia".

Alternativa: mais uma opção no select, com selo por opção. Descartada: o selo da etapa 2 continuaria errado.

Alternativa no RCPN: uma quinta opção em `rcpn-certidao`. Descartada: não diria de qual registro é, e a gratuidade perguntaria o inteiro teor duas vezes.

### Pedidos antigos de inteiro teor ficam como digital

O id `inteiro-teor` não muda, só o nome. Os pedidos antigos passam a aparecer como "digital", o que corresponde ao selo "Termina on-line" que eles receberam.

### Nome e prazo do papel

O nome usa "papel de segurança", termo dos arts. 52 e 53 do Provimento 156. "Papel moeda" é o termo do dia a dia, mas não aparece no texto lido.

O prazo é de 5 dias, pelo art. 19, § 10, III, porque o inciso I trata só do meio eletrônico. O digital segue com o prazo de 1 dia que o ato já tem, porque a contagem em dias não representa as 4 horas da lei.

### A ordem do texto do selo muda

Hoje `ProcessingHint` mostra primeiro o texto de "Só identificação". No papel, isso esconderia que é preciso ir ao balcão. `processingHint` do ato passa a ter prioridade, e o papel traz um texto que diz as duas coisas.

### Finalidade sempre, menos no óbito

O art. 117, § 3º, pede o motivo em todo requerimento de inteiro teor, sem exceção para o próprio interessado. O responsável pelo produto tinha indicado que o próprio interessado dispensaria a justificativa, e aceitou a regra da norma ao aprovar este desenho.

O § 3º também é a base para a exceção ao art. 17. As demais certidões continuam sem pedir finalidade.

No óbito, nada disso é perguntado (arts. 118 e 119). Quem define é uma marca na opção do catálogo, e uma função pura do núcleo responde se o bloco vale para o ato e a opção escolhidos. O site, o balcão e o PDF usam a mesma função.

### Respostas em `details`, sem migração

`details.requesterQualification` guarda `{ role, representedName?, kinship?, registrantDeceased }`. `role` é `self`, `attorney` ou `other`. A finalidade continua na coluna `purpose`, já lida pelo painel e pelo PDF.

Alternativa: colunas novas. Descartada: é dado de um ato só, como `phone` e `alternateDocument`, e nada busca por esses campos.

### Qualquer pessoa envia, e a serventia analisa

O site não trava a falta do mandato. O responsável pelo produto definiu que a serventia barra depois do recebimento, e o fluxo já tem indeferimento e exigência. O mandato segue pelos anexos do pedido, e o operador confere o arquivo.

O formulário pede o mandato sem validar os poderes, e a observação diz que o procurador precisa de poderes especiais, como no art. 114. O art. 114 não pede forma pública, então a procuração particular serve. A suficiência dos poderes é analisada pelo operador.

### Observação em texto único

Uma constante no catálogo guarda o aviso, para o site e o balcão dizerem o mesmo:

> Alguns registros têm dados sensíveis, restritos ou sigilosos, como adoção, reconhecimento de filho, mudança de nome ou sexo de pessoa trans e mudança de nome de testemunha protegida. A certidão desses registros só sai com autorização judicial quando quem pede não é o interessado, o representante legal ou um procurador com poderes especiais. Na mudança de nome ou sexo de pessoa trans, só a própria pessoa pede sem ordem judicial. O pedido é analisado depois do recebimento e pode ser recusado se faltar o mandato ou outro documento necessário.

O texto foi corrigido depois da conferência no site do CNJ. O art. 114, § 1º, torna a autorização obrigatória para terceiro, e não uma possibilidade. Só a mudança de nome de pessoa trans (art. 116, § 2º, e art. 529, § 1º) e a de testemunha protegida (art. 116, § 3º) são restritas ou sigilosas, e não toda mudança de nome.

### Assinatura por ato

O art. 117 lista firma reconhecida, ICP-Brasil, Gov.br e assinatura conferida com o documento original, e não cita o e-Notariado. O § 1º dispensa a firma quando o requerimento é assinado na frente do oficial ou do preposto. O ato ganha um texto próprio de assinatura, com o balcão como alternativa ao reconhecimento, usado na tela de sucesso, nas telas de consulta do protocolo e no PDF no lugar do aviso geral.

Alternativa: manter o e-Notariado, como foi pedido no início. Descartada até haver fundamento para este ato.

## Risks / Trade-offs

- **Dois itens a mais na lista** → os nomes dizem a diferença, e o selo reforça onde termina.
- **Mandato sem poderes especiais** → o art. 114 fala nesses poderes, e sem eles o advogado pode ser tratado como terceiro. O operador decide, e a observação avisa que o pedido pode ser recusado.
- **Gratuidade sem as perguntas** → um pedido isento de inteiro teor não traz motivo nem parentesco, e o operador os pede por exigência.
- **Requerimento no óbito** → o site pede o que o art. 118 dispensa, como já acontece hoje na certidão de óbito.
- **Papel do RCPN** → o art. 53, I, de 2020, exige papel unificado, e a Lei 6.015, art. 19, § 5º, de 2022, prevê certidão eletrônica. O verbum ad verbum é `hybrid`, e quem pede escolhe no formulário a certidão digital, pelo site, ou em papel, no balcão, por decisão do responsável pelo produto. A escolha fica em `details.deliveryFormat`, sem migração, e vale também no óbito.
- **Outras serventias** → o catálogo vale para todas, e alguma pode não oferecer o papel ou o verbum ad verbum.

## Open Questions

- **Certidão digital de imóveis:** resolvida. O responsável pelo produto confirmou que a serventia entrega pelo site, onde o pedido é feito. O selo "Termina on-line" fica.
- **Pagamento do papel:** resolvida. Digital e papel são pagos no fluxo comum do pedido. Quem pede escolhe a forma, e a serventia lança o valor de cada uma. O sistema não mostra nem calcula preço.
- **Verbum ad verbum:** resolvida. O ato termina no balcão ou on-line, e o formulário pergunta qual dos dois.
- **Lei 8.560 e norma de pessoa trans:** o art. 116, § 2º, cita as duas como restritas, e elas não foram lidas. A observação não cita artigos, então não depende disso.
