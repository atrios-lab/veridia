## MODIFIED Requirements

### Requirement: Catálogo completo de atos com selo de tramitação
O catálogo do núcleo DEVE (SHALL) cobrir os atos das seis atribuições (conferidos contra o sistema
anterior, com base legal), documentos esperados quando houver, finalidade apenas nos atos que a
exigem (certidão nunca exige, Lei 6.015 art. 17) e descrição obrigatória nos atos "outro".

Cada ato DEVE (SHALL) carregar duas informações independentes, porque são duas perguntas
diferentes e um ato responde as duas:

- **modo de tramitação** (`online`, `presential`): se o pedido se resolve pela internet ou termina
  no balcão;
- **só identificação** (sinalizador): se a serventia atende sem pedir papel além da identificação
  do requerente.

A exibição DEVE (SHALL) traduzir cada uma em linguagem direta ("100% on-line", "On-line +
presencial", "Só identificação") e mostrar as duas quando as duas valem.

Nenhum texto do catálogo SHALL afirmar que um ato dispensa o requerimento: o requerimento
assinado é pedido ao fim de todo pedido feito pelo site.

#### Scenario: Filtro por atribuição do tenant
- **WHEN** um tenant não possui uma atribuição
- **THEN** nenhum ato dela aparece no wizard, e a contagem "N atos" dos cards reflete só os atos disponíveis

#### Scenario: Selo em linguagem direta
- **WHEN** a etapa 2 lista um ato `presential`
- **THEN** o selo mostra "On-line + presencial" com a explicação de que o pedido adianta a análise e o ato termina no balcão

#### Scenario: Um ato que responde as duas perguntas mostra as duas
- **WHEN** a etapa 2 lista uma certidão, que é `online` e só exige identificação
- **THEN** o cidadão lê "100% on-line" e "Só identificação", e não é obrigado a escolher entre saber
  uma coisa ou a outra

#### Scenario: Nada promete dispensar o requerimento
- **WHEN** o cidadão abre qualquer ato do catálogo
- **THEN** nenhum texto diz que aquele ato não tem requerimento, porque a tela de sucesso pede o
  requerimento assinado em todos eles
