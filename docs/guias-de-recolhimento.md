# Guias imobiliárias (Utilitários)

Antes se chamavam "Guias de recolhimento". O nome mudou em 11/11/2026 porque
"recolhimento", sozinho, não dizia de que serviço se tratava. Todas as guias
deste utilitário são da transmissão de um imóvel: ITIV/ITBI, ITCD/ITCMD
(doação e causa mortis), laudêmio e certidão de débitos imobiliários (IPTU).
O subtítulo da tela é montado a partir do catálogo (`guideKindsSummary`), e um
tipo novo aparece nele sem outra mudança. O PDF traz, acima do título, o fisco
e o tipo da guia ("Fisco municipal · ITIV / ITBI").

As guias excluídas liberam o número. Em Configurações › Numeração dá para
alterar o número de uma guia emitida, excluir uma de teste e voltar a
numeração ao automático.

O painel gera o requerimento que o tabelião assina e a parte leva ao fisco antes da escritura. Com ele, a
Prefeitura ou a SET/RN emite o documento de arrecadação. Esta página lista de onde vem cada regra e o que foi
conferido no texto oficial, em 9 de novembro de 2026.

Os textos federais foram lidos na base de legislação do Senado Federal (`legis.senado.leg.br`), que traz o
texto compilado da Câmara. O Planalto não respondeu a partir do ambiente de desenvolvimento. A lei estadual
foi lida no site da Assembleia Legislativa do RN.

| Regra | Fonte | Conferido no texto oficial |
| --- | --- | --- |
| ITBI: fato gerador, valor venal (valor de mercado), município da situação, contribuinte | CTN, arts. 35, 38, 41 e 42, redação da LC nº 227/2026; CF, art. 156, II | Sim (Senado) |
| Cartório informa as operações ao município | CTN, art. 38, § 4º (LC nº 227/2026) | Sim (Senado) |
| ITCD do RN: 3% até R$ 500 mil; 4% até R$ 1 milhão; 5% até R$ 3 milhões; 6% acima, cada um sobre a parcela da faixa | Lei Estadual nº 5.887/1989, art. 7º, redação da Lei nº 9.993/2015 | Sim (AL/RN) |
| Laudêmio federal: 5% do domínio pleno do terreno, sem benfeitorias, pago antes pelo vendedor | Decreto-Lei nº 2.398/1987, art. 3º, caput (Lei nº 13.465/2017) | Sim (Senado) |
| Escritura só com certidão da SPU (CAT) | DL nº 2.398/1987, art. 3º, § 2º, I, a a c | Sim (Senado) |
| Transferência na SPU em 60 dias; multa de 0,50% ao mês | DL nº 2.398/1987, art. 3º, §§ 4º e 5º | Sim (Senado) |
| DOITU pelo cartório | DL nº 2.398/1987, art. 3º-A | Sim (Senado) |
| Laudêmio municipal: 2,5% sobre o preço da alienação, salvo outra taxa no título | Código Civil de 1916, art. 686 | Sim (Senado) |
| Vedado laudêmio sobre construções e plantações | Código Civil de 2002, art. 2.038, § 1º, I | Sim (Senado) |
| Comprovante do ITBI e certidões fiscais na escritura | Lei nº 7.433/1985, art. 1º, § 2º; Decreto nº 93.240/1986, art. 1º, II e III, a, e § 2º | Sim (Senado) |
| Dever de fiscalizar o recolhimento | Lei nº 8.935/1994, art. 30, XI | Sim (Senado) |
| Responsabilidade do tabelião | CTN, art. 134, VI | Sim (Senado) |
| Qualificação das partes | Lei nº 6.015/1973, art. 176, § 1º, III, 2; CPC, art. 319, II | Sim (Senado) |

## O que não foi conferido

- **ITIV de cada município.** A lei e a alíquota são da serventia, em "Leis, alíquotas e quem assina". Ielmo
  Marinho vem com a Lei Complementar Municipal nº 44/2021, art. 91, e 3%, tirados da guia da própria
  serventia. O texto da lei municipal não está publicado na internet.
- **Destinatário na SET/RN.** A CACE vem do modelo da serventia. O site da SET/RN não respondeu.
- **STF, Tema 1124.** Discute se o ITBI só é devido no registro. A guia não diz que o pagamento prévio é
  obrigatório: cita a lei municipal e o dever de fiscalizar.

## Edição manual

Tudo na guia pode ser ajustado à mão, antes ou depois de emitida:
- alíquota, inclusive no ITCD, em vez da tabela;
- valor do imposto;
- destinatário e lei citada;
- número da guia.

O Word baixado também é editável.

## Guarda

Cada guia fica 12 meses no sistema. Nos últimos 30 dias, o painel pede que a serventia baixe as guias, com o
botão "Baixar todas do ano", e guarde no próprio arquivo na nuvem. Depois disso a guia vai para "Prazo de
guarda vencido", mas não é apagada: apagar dados do banco exige uma PR revisada (CLAUDE.md).

## Pedido pelo site

Em Notas, o ato "Guia imobiliária" pede:
- as partes: nome, CPF ou CNPJ, tratamento, estado civil, profissão e endereço;
- o imóvel;
- o valor declarado;
- os documentos anexados.

Não há leitura automática dos anexos: é decisão do produto, de 09/11/2026.

A guia é gerada sozinha, numerada e ligada ao pedido. Ela aparece só no painel, em Utilitários e no próprio
pedido. A serventia confere, corrige e gera de novo se precisar. Depois assina e entrega a guia com o boleto
em "Entrega ao cidadão", mudando o andamento para "Aguardando pagamento da guia", ou envia aos órgãos.

## Certidão de débitos do IPTU

Não é oferecida como guia, por decisão do produto de 09/11/2026: o débito do imóvel aparece quando a Prefeitura
gera o ITIV. O tipo continua no código só para que uma guia já emitida assim seja lida e impressa.

## Onde a serventia trabalha os pedidos

Os pedidos de guia não entram na fila de Pedidos de serviço. Eles aparecem em Guias imobiliárias, na seção
"Pedidos do site", e o item do menu mostra quantos estão em aberto.

O painel avisa, em qualquer tela, com cartão, som e notificação do navegador:
- quando chega um pedido novo de guia;
- quando o cliente atualiza um pedido (envia documento, responde exigência ou informa pagamento).

Em Configurações › Notificações a serventia escolhe, para este e para os outros canais (chat, agenda,
pedidos, LGPD e ouvidoria), se avisa ou silencia, se aparece o aviso na tela, a notificação do navegador, o
som e se a tela treme e o celular vibra.

## Qualificação: união estável

Para quem não é casado (solteiro, viúvo, separado ou divorciado), a qualificação traz a declaração "que declara,
sob as penas da lei, que (não) mantém união estável". As opções mais curtas que já existiam continuam
disponíveis.
