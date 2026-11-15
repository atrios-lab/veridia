## Context

A serventia (Cartório Único) qualifica títulos de registro de imóveis, de títulos e documentos e de
pessoas jurídicas. Hoje as notas devolutivas são escritas no Word. Os dois modelos enviados mostram
dois formatos que o sistema precisa produzir:

- **primeira qualificação:** objeto, natureza da devolução (com o direito à dúvida), fundamentos
  gerais, exigências numeradas e agrupadas por imóvel, observações, forma de cumprimento, conclusão,
  referências;
- **reexame após reapresentação:** o que foi atendido, exigências que permanecem, exigências novas e
  a lista de providências.

Os dois têm cabeçalho oficial, "NOTA DEVOLUTIVA nº/ano", apresentante, documento apresentado,
protocolo de tramitação (o número REQ dos pedidos da plataforma), cidade e data e observações
importantes sobre reexame e prazo.

A plataforma já tem o que a qualificação usa: pedidos do balcão online com protocolo REQ, numeração
anual de documentos (`document-numbering`), PDF (`renderDocument`) e Word (`renderDocumentDocx`),
assinatura digital PAdES e física (`SignOrPrint`), envio ao cliente pelo pedido, auditoria com
justificativa, permissões por recurso e calendário de dias úteis da serventia. Não há, ainda, nenhuma
integração com IA.

## Goals / Non-Goals

**Goals:**

- Qualificar com padrão: exigências como itens estruturados (não texto corrido), cada uma com
  fundamento, o que apresentar e a situação.
- Montar sozinho o reexame a partir da nota anterior.
- Emitir nota e qualificação positiva no padrão da serventia, numeradas, assinadas e enviadas.
- Controlar os prazos por atribuição.
- Na fase 2, a IA propõe o rascunho; a pessoa revisa, edita e aprova.

**Non-Goals:**

- Ver a seção Non-goals da proposta: a IA não decide; sem registro na matrícula, sem protocolo
  oficial, sem suscitação de dúvida, sem custas, sem integração com ONR, SAEC ou e-Notariado.

## Decisions

1. **Exigência como item estruturado.** `{ id, titulo, descricao, comoCumprir, fundamento,
   referencia (imóvel ou documento), situacao: pendente | cumprida | parcial | nova, origem:
   biblioteca | redigida }`. Assim o reexame, a lista de providências e os relatórios saem do mesmo
   dado. *Alternativa:* guardar a nota como texto; descartada, porque impede o reexame automático.
2. **Biblioteca de exigências por atribuição e tipo de ato**, com fundamento e texto-base editáveis
   e uso contado (as mais usadas primeiro). Começa com as exigências dos modelos, reescritas de
   forma genérica e com dados fictícios. *Alternativa:* deixar a IA redigir tudo; descartada pelo
   padrão e pela segurança jurídica.
3. **Núcleo puro em `src/core/qualificacao`.** Tipos, montagem da nota (primeira e reexame), lista de
   providências, regra do art. 198 (aviso de exigência nova sem documento novo), prazos por
   atribuição. Isso deixa tudo testável sem banco nem IA, como os outros utilitários.
4. **Documento pelo `RequerimentoDocument`.** A nota e a qualificação positiva seguem a mesma
   estrutura dos outros documentos (seções, tabelas, data, assinatura, rodapé), saem em PDF e Word e
   passam pelo assinador. A numeração é uma série anual nova ("nota devolutiva"), com editar,
   excluir e modificar numeração como nas outras séries.
5. **Ligação com o pedido.** A qualificação guarda o protocolo REQ; o pedido mostra a nota ou a
   qualificação positiva e permite ao apresentante baixá-la e reapresentar documentos. A
   qualificação do balcão presencial pode existir sem pedido.
6. **Prazos por atribuição, no núcleo, a partir do texto vigente da lei** (conferido no compilado
   oficial na implementação). As "observações importantes" da nota usam o prazo calculado, não um
   texto fixo, para não repetir prazo revogado.
7. **IA na fase 2, só no servidor.** Chama a Claude (Anthropic) com os documentos do pedido (PDF e
   imagens) e um roteiro por atribuição e tipo de ato. A resposta vem estruturada (JSON validado com
   zod): resultado proposto, dados extraídos, exigências (id da biblioteca ou redação nova, com
   fundamento) e o trecho do documento que motivou cada uma. O rascunho é salvo como "proposta da
   IA"; a nota só existe quando uma pessoa aprova. A chave fica como segredo do ambiente. O Tabelião
   liga ou desliga a IA em Configurações, e cada chamada fica na auditoria (quem, quando, qual
   qualificação), sem o conteúdo.
   *Alternativa:* leitura por regras, como as cargas; descartada, porque qualificar exige entender o
   título e confrontá-lo com a matrícula.
8. **Base jurídica em Markdown.** Todo documento recebido (PDF, Word, ODT, RTF, texto, HTML e ZIP
   com qualquer deles) é lido em memória, convertido em Markdown (artigos como títulos, parágrafos em
   negrito, incisos e alíneas em lista, títulos e capítulos como seções) e descartado. A fonte guarda
   só o Markdown dividido por artigo; reimportar cria uma fonte nova e marca a anterior, nunca apaga.
   A pesquisa pondera a hierarquia das fontes e ignora as revogadas; na fase 2, os trechos achados
   vão à IA com a referência, e ela só fundamenta com o que está na base.
9. **Documentos anexados.** Ficam ligados à qualificação enquanto ela está aberta (o reexame precisa
   deles). Depois da emissão, a serventia escolhe se guarda ou descarta, como pede a decisão de não
   encher o banco.

10. **IA de finalidade única, sem interação.** Decisão de 15/11/2026: o cartório não conversa com a
    IA. Não há chat nem campo de pergunta livre. A serventia só alimenta a base jurídica (o
    aprendizado) e dispara as tarefas fixas da plataforma: transcrever documentos para a base e,
    na fase 2, qualificar o título. Cada tarefa tem instrução fixa no código, e toda chamada leva a
    mesma instrução de papel ("só qualificação e aprendizado para ela"). Nenhum texto digitado por
    pessoa vai à IA como instrução, e o conteúdo dos documentos é tratado como dado: ordem escrita
    dentro de um documento é ignorada. A pesquisa da base é feita pelo próprio sistema, sem IA.
11. **A IA pergunta por botão e só consulta a fonte jurídica oficial.** Quando precisa (norma
    alterada ou revogada, texto que falta), a IA deixa um pedido na base ("Deseja inserir o texto
    atualizado?"), respondido por botão: importar do site oficial, enviar o documento ou dispensar
    com motivo. A consulta à internet usa as ferramentas de busca e leitura da API limitadas por
    domínio aos sites oficiais (planalto.gov.br, in.gov.br, jus.br, camara.leg.br, senado.leg.br).
12. **Arquivo errado.** Trocar o arquivo cria versão nova e guarda a anterior. Na leitura, o núcleo
    aponta o provável erro (não jurídico, referência ausente do texto, CPF, repetida, lida pela IA)
    e a fonte fica "em conferência", fora da pesquisa e da IA, até confirmação ou troca.

## Risks / Trade-offs

- [A IA erra ou inventa um fundamento] → Rascunho sempre revisado. Cada exigência mostra o trecho do
  documento que a motivou, e fundamentos fora da biblioteca vêm marcados para conferência.
- [Dados pessoais enviados a terceiro] → Só o necessário de cada qualificação, contrato sem
  retenção, liga/desliga pelo Tabelião, auditoria. A serventia decide antes de ligar.
- [Prazo legal desatualizado no modelo (30 dias)] → Prazo calculado pelo núcleo a partir do texto
  vigente, com teste.
- [Exigência nova no reexame contra o art. 198] → Aviso na tela quando uma exigência nova não
  decorre de documento novo.
- [Custo por chamada da IA] → A IA só roda quando a pessoa pede, uma vez por documento, com
  contagem de uso por mês.

## Migration Plan

- Fase 1 (sem IA): migração que só cria tabelas, a biblioteca inicial, a nota, o reexame, a
  qualificação positiva, a numeração, os prazos, a assinatura e o envio.
- Fase 2 (IA): dependência da Anthropic, chave pedida pelo formulário seguro do ambiente, chave de
  liga/desliga desligada por padrão.
- Rollback: desligar a IA em Configurações; a fase 1 continua manual. Nada é apagado.

## Open Questions

- Atribuições: decidido em 15/11/2026, todas, nesta ordem: RCPN, RI, Notas, RTD, RCPJ e Protesto.
- A serventia autoriza o uso da Claude (Anthropic) e fornecerá a chave de API? Decisão provisória:
  sim, na fase 2, desligada por padrão.
- Há modelo de qualificação positiva? Decisão provisória: o mesmo padrão visual das notas.
- Os documentos anexados são guardados depois da emissão ou descartados? Decisão provisória: a
  serventia escolhe em Configurações.
