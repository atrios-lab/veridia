## ADDED Requirements

### Requirement: Espécie, livro e atos da cédula

A análise SHALL indicar a espécie da cédula, o ato da própria cédula (livro ou órgão), os atos de cada garantia, o órgão competente, o prazo e o fundamento legal vigente. Quando a doutrina de referência divergir da lei vigente, a análise SHALL avisar e citar o artigo que mudou. Essa parte SHALL funcionar com o assistente virtual desligado.

#### Scenario: Cédula rural hipotecária
- **WHEN** a análise recebe uma Cédula Rural Hipotecária com um imóvel desta circunscrição
- **THEN** ela indica o registro da hipoteca na matrícula, diz que a cédula não tem mais inscrição própria (Lei 13.986/2020) e cita o prazo da Lei 6.015, art. 188

#### Scenario: CPR
- **WHEN** a análise recebe uma CPR com penhor rural
- **THEN** ela indica o registro ou depósito da CPR em entidade autorizada pelo Banco Central e o registro do penhor no Livro 3 do RI onde estão os bens, no prazo de 3 dias úteis

### Requirement: Modelos escolhidos pelo cartório

A análise SHALL gerar, a partir dos dados conferidos, os modelos dos atos cabíveis (registro, averbação, remissão, certidão e atos posteriores). Cada modelo SHALL ter o seu próprio botão. O cartório SHALL poder editar, copiar, imprimir e baixar em Word cada modelo, e SHALL poder voltar ao texto gerado.

#### Scenario: Escolher o modelo
- **WHEN** o funcionário clica em "Registro na matrícula"
- **THEN** o modelo aparece preenchido com os dados da cédula, com `[preencher: ...]` onde faltar dado, pronto para editar, copiar, imprimir ou baixar em Word

### Requirement: Documentos lidos e descartados

Os documentos anexados para a análise SHALL ser lidos e descartados. A análise SHALL guardar só os dados extraídos, os modelos e os nomes dos arquivos. A análise aberta a partir de um pedido SHALL ler os anexos do pedido e SHALL ficar ligada ao protocolo, com a opção de desfazer o vínculo.

#### Scenario: Análise pelo pedido
- **WHEN** o funcionário clica em "Analisar cédula" num pedido
- **THEN** a análise abre com os anexos do pedido e aparece no pedido, e os arquivos continuam só no pedido

### Requirement: Aprendizado sem dados pessoais

Quando o funcionário corrigir a espécie, a análise SHALL guardar só a expressão do título, sem números, nomes ou documentos de pessoas. Nas análises seguintes com aquela expressão, a espécie aprendida SHALL ser a primeira sugestão.

#### Scenario: Correção da espécie
- **WHEN** o funcionário troca a espécie sugerida de uma cédula com o título "CÉDULA RURAL PIGNORATÍCIA Nº 123"
- **THEN** o sistema guarda "cedula rural pignoraticia" ligada à espécie escolhida, sem o número

### Requirement: Editar e apagar a análise

A análise e cada modelo SHALL poder ser editados. Cada edição SHALL guardar o valor anterior no histórico. "Apagar" SHALL ocultar a análise sem remover a linha do banco e SHALL pedir confirmação e motivo. "Restaurar" SHALL desfazer o apagar. Todas essas ações SHALL ser registradas na auditoria.

#### Scenario: Apagar e restaurar
- **WHEN** o funcionário apaga uma análise com o motivo "aberta por engano" e depois a restaura
- **THEN** a análise some da lista, volta com "Restaurar", e a auditoria registra as duas ações

### Requirement: Aditivos e cobrança

Para cada aditivo, a análise SHALL indicar o que mudou: prazo, valor, encargos, garantia, partes ou rerratificação. A análise SHALL dizer se o aditivo é averbação ou se pede também o registro de uma garantia nova. A análise SHALL indicar a base de cobrança: sobre o crédito suplementar, sobre o crédito garantido ou ato sem conteúdo econômico. A serventia SHALL poder escrever, para cada base de cobrança, a nota que aponta o item da sua tabela de emolumentos.

#### Scenario: Aditivo só de prazo na cédula rural
- **WHEN** o aditivo de uma cédula rural só prorroga o vencimento
- **THEN** a análise indica averbação sem conteúdo econômico (Lei 10.169/2000, art. 2º, § 2º, II, c) e lembra que a lei dispensa o aditivo (DL 167/1967, art. 62)

#### Scenario: Aditivo com crédito suplementar e bem novo
- **WHEN** o aditivo aumenta o crédito e vincula um imóvel novo
- **THEN** a análise indica o registro da garantia nova e a averbação do aditivo, com base de cálculo no crédito suplementar

### Requirement: Lei que mudou, com a regra vigente e como fazer

Quando a doutrina ou a regra antiga divergir da lei vigente, a análise SHALL mostrar três coisas: como era, o que vale hoje (a norma vigente, com o artigo) e como fazer agora, passo a passo. A análise NÃO SHALL dizer só que a norma foi revogada.

#### Scenario: Cédula rural
- **WHEN** a análise mostra uma cédula rural
- **THEN** ela diz que os arts. 30 a 40 do DL 167/1967 foram revogados pela Lei 13.986/2020, que hoje se registram as garantias, e como registrar cada uma (hipoteca na matrícula, penhor rural no Livro nº 3), com prazo e artigos

### Requirement: Tabela de emolumentos vigente como referência

A cobrança SHALL citar a tabela de emolumentos vigente, que é a primeira "Tabela de emolumentos" publicada em Transparência. Onde a tabela for citada, a tela SHALL mostrar o lembrete para conferir se a tabela cadastrada é mesmo a vigente, com o link "clique aqui para atualizar" para Transparência. Sem tabela cadastrada, a tela SHALL pedir que se publique a tabela vigente.

#### Scenario: Tabela não cadastrada
- **WHEN** a serventia não tem tabela de emolumentos publicada
- **THEN** a análise avisa e oferece "clique aqui para atualizar", que leva a Transparência

### Requirement: Nota de exigência a partir da análise

Depois da análise, a tela SHALL sugerir as exigências do que falta, cada uma com fundamento:
- requisitos do título;
- matrícula do imóvel;
- bem fora da circunscrição;
- local dos bens apenhados;
- outorga do cônjuge;
- série e custodiante da CCI;
- título sem ato.

A tela NÃO SHALL sugerir documento que a lei veda exigir (CCIR, ITR, CND nas cédulas). O funcionário SHALL poder desmarcar, editar e acrescentar exigências. A nota SHALL abrir na Qualificação de títulos (Registro de Imóveis), onde é numerada, assinada e entregue, e SHALL ficar ligada à análise.

#### Scenario: Emitente casado sem anuência
- **WHEN** a análise mostra emitente casado dando imóvel em hipoteca sem o cônjuge
- **THEN** a tela sugere a exigência "Outorga do cônjuge" (Código Civil, art. 1.647, I), e "Criar a nota de exigência" abre a qualificação com ela
