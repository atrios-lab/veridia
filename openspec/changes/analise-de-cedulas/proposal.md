## Why

O Tabelião/Registrador recebe cédulas de crédito (rurais, industriais, de produto rural, bancárias e outras). Para cada uma, precisa decidir rapidamente:

- qual é a espécie da cédula;
- em qual livro ela entra e quais atos ela pede (registro, averbação, remissão), e se algum deles cabe a outro órgão;
- qual é o prazo para praticar o ato.

As leis das cédulas mudaram muito em 2020 e 2022 (Leis 13.986/2020 e 14.421/2022). O material de estudo mais usado, o Caderno IRIB nº 9 (2016), ficou desatualizado para as cédulas rurais e para a CPR. O dono do projeto pediu um campo em Utilitários que:

- diga a espécie, o livro e os atos de cada cédula;
- sugira os modelos de registro, averbação, remissão, certidão e outros que a norma permitir;
- use o assistente virtual para ajudar, mas deixe o cartório anexar PDF e outros documentos.

## What Changes

- Nova ferramenta **Utilitários › Análise de cédulas**, com dois modos de entrada:
  - **avulsa**: o funcionário anexa a cédula, os aditivos e a matrícula (PDF, foto ou Word);
  - **pelo pedido do balcão online**: o botão "Analisar cédula" no pedido abre a análise com os anexos do pedido e a deixa ligada ao protocolo. Esse vínculo pode ser feito ou desfeito depois.
- **Matriz fixa das espécies**, conferida no texto oficial da lei em 21/11/2026. Para cada espécie ela traz:
  - o ato da cédula;
  - os atos das garantias;
  - o órgão competente;
  - o prazo;
  - o fundamento.

  Quando o caderno de 2016 diverge da lei atual, a tela avisa e cita o artigo que mudou. A matriz funciona mesmo com o assistente virtual desligado.
- **Leitura dos documentos**: o assistente virtual (quando ligado) lê os documentos e extrai espécie, partes, valor, vencimento, garantias, bens e matrículas. Sem o assistente, o sistema lê o texto do PDF ou do Word e reconhece a espécie pelo título. Em qualquer caso, o funcionário confere e corrige os dados.
- **Modelos gerados com os dados extraídos**, cada um com o seu botão; o cartório escolhe quais quer e pode editar, copiar, imprimir e baixar em Word cada um:
  - registro no Livro 3;
  - registro na matrícula;
  - averbação da emissão;
  - averbação da localização do penhor;
  - remissão;
  - registro do patrimônio rural em afetação;
  - certidão;
  - atos posteriores: aditivo, endosso, liberação parcial e cancelamento.
- **Aditivos e aditamentos** (pedido do dono do projeto em 21/11/2026). Para cada aditivo, a análise:
  - mostra o que mudou: prazo, valor para mais ou para menos, encargos, garantia incluída, substituída ou liberada, partes ou rerratificação;
  - diz se a mudança é averbação ou se pede também o registro de uma garantia nova (bem novo vinculado);
  - mostra como cobrar: ato com valor, sobre o crédito suplementar ou sobre o crédito garantido, ou ato sem conteúdo econômico, conforme a Lei 10.169/2000, art. 2º, III e § 2º, II, "b" e "c";
  - aceita uma nota de cobrança escrita pela serventia para cada tipo de ato, que aponta o item da tabela do Estado.
- **Lei que mudou** (pedido de 21/11/2026): o aviso mostra como era, o que vale hoje (a norma vigente, com o artigo) e como fazer agora, passo a passo.
- **Tabela vigente**: a cobrança cita a tabela de emolumentos vigente publicada em Transparência, sempre com o lembrete para conferir se ela é mesmo a vigente e com o link "clique aqui para atualizar".
- **Arquivos não ficam guardados**: os documentos da cédula são lidos e descartados. Ficam a análise (dados e modelos) e os nomes dos arquivos. Os arquivos que vieram de um pedido continuam no pedido.
- **Aprendizado sem dados pessoais**: quando o funcionário corrige a espécie, o sistema guarda só a expressão do título, sem números nem nomes. Na próxima cédula com aquele título, a espécie certa vem primeiro.
- **Documentos que ensinam** (leis, provimentos, cadernos, modelos) continuam indo para a Base jurídica, que guarda o texto e descarta o arquivo. A ferramenta consulta a Base jurídica nos fundamentos.
- **Editar e apagar**: a análise e cada modelo podem ser editados. "Apagar" oculta, sem tirar do banco. O valor anterior fica no histórico, e cada ação fica na auditoria.
- **Acesso**: todos os usuários do painel. A permissão "Análise de cédulas" nasce derivada da mesa de trabalho, e o Tabelião pode restringi-la em Perfis e permissões.

## Non-goals

- Lavrar o ato ou numerar o Livro 2 ou o Livro 3: a ferramenta entrega minutas, e o ato continua sendo lavrado no sistema do cartório.
- Calcular emolumentos: a tela só cita as regras especiais (Lei 10.169/2000, art. 2º, § 2º; Lei 8.929/1994, art. 12, § 3º; Lei 10.931/2004, arts. 18, § 6º, e 42-B).
- Registro em Títulos e Documentos: a tela avisa quando ele é necessário, mas não gera o ato.

## Capabilities

### New Capabilities

- `analise-de-cedulas`: análise da cédula (espécie, livro, atos, competência, prazo), modelos dos atos, vínculo ao pedido e aprendizado sem dados pessoais.

### Modified Capabilities

(nenhuma)

## Impact

- Novos: `src/core/cedulas/` (matriz, plano dos atos, modelos e aprendizado), `src/lib/cedulas.ts`, tarefa fixa do assistente virtual em `src/lib/ai.ts`, telas em `utilitarios/cedulas`, botão no pedido.
- Banco: duas tabelas novas (`cedula_analyses`, `cedula_learned_cues`). A migração só acrescenta, e as tabelas entram em `DEMO_RESET_KEPT`.
- Permissão `cedulas.manage` derivada de `desk.access`. Item novo no menu de Utilitários e rótulos de auditoria.
