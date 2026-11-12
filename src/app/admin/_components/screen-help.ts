import type { Permission } from "@/core/auth/roles.ts";

/**
 * What each screen of the panel is for, how to use it and where it is set
 * up (decision of 11/11/2026): the "!" beside the title opens it, and
 * "Configurar" goes straight to the settings that change the screen, so a
 * clerk never has to guess which tab of Configurações holds them. A new
 * screen adds its entry here and the header shows both by itself.
 */
export interface ScreenHelp {
  /** What the screen is for, in one or two sentences. */
  purpose: string;
  /** How to use it, step by step. */
  steps: string[];
  /** The words of the screen a lay reader may not know, explained. */
  terms?: { term: string; meaning: string }[];
  /** Where it is set up, when it has settings of its own. */
  configure?: {
    href: string;
    label: string;
    permission: Permission;
    /** What is set there, step by step. */
    steps: string[];
  };
}

/**
 * The rules the Livro Diário Auxiliar follows, as ABNT NBR 6023:2018 sets
 * a legislative reference (decision of 12/11/2026).
 */
const REF_CN_149 =
  "BRASIL. Conselho Nacional de Justiça. Corregedoria Nacional de Justiça. Provimento nº 149, de 30 de agosto de 2023. Institui o Código Nacional de Normas da Corregedoria Nacional de Justiça, Foro Extrajudicial (CNN/CN/CNJ-Extra). Brasília, DF: CNJ, 2023.";
const REF_CN_259 =
  "BRASIL. Conselho Nacional de Justiça. Corregedoria Nacional de Justiça. Provimento nº 259, de 5 de novembro de 2026. Altera o Código Nacional de Normas quanto ao Livro Diário Auxiliar da Receita e da Despesa e revoga o Provimento nº 45, de 13 de maio de 2015. Brasília, DF: CNJ, 2026.";
const REF_CN_24 =
  "BRASIL. Conselho Nacional de Justiça. Corregedoria Nacional de Justiça. Provimento nº 24, de 12 de outubro de 2012. Brasília, DF: CNJ, 2012.";
const REF_RN_156 =
  "RIO GRANDE DO NORTE. Corregedoria Geral de Justiça. Provimento nº 156, de 18 de outubro de 2016. Institui, no âmbito extrajudicial, o novo Código de Normas da Corregedoria Geral de Justiça do Estado do Rio Grande do Norte. Natal: CGJ/RN, 2016.";

const ENTRIES: Record<string, ScreenHelp> = {
  "/admin": {
    purpose:
      "O resumo do dia: o que está esperando a serventia, ordenado por urgência, e os atalhos para as tarefas mais comuns.",
    steps: [
      "Comece pela lista 'Sua mesa hoje': cada item leva direto ao pedido, agendamento ou mensagem.",
      "Use a busca no alto (Ctrl K) para achar um protocolo, um nome ou uma tela.",
      "Os números ao lado do menu mostram o que ainda não foi visto em cada área.",
    ],
    configure: {
      href: "/admin/configuracoes",
      label: "Dados da serventia",
      permission: "content.edit",
      steps: [
        "Em Configurações › Dados gerais ficam o nome, o endereço, os contatos, os prazos e os feriados da serventia.",
        "Altere o que precisar e clique em Salvar no fim de cada quadro.",
      ],
    },
  },
  "/admin/pedidos": {
    purpose:
      "A fila dos pedidos de serviço feitos pelo site ou lançados no balcão: certidões, escrituras, guias, exigências e entregas ao cidadão.",
    steps: [
      "Clique no protocolo para abrir o pedido.",
      "Confira os documentos enviados e, se faltar algo, faça uma exigência (o cidadão é avisado).",
      "Informe o valor quando houver cobrança; o cidadão paga pelo Pix.",
      "Anexe o documento final em 'Entrega ao cidadão' (dê o nome e escolha assinar digitalmente ou enviar como está).",
      "Mude o andamento até 'Concluído'.",
    ],
    configure: {
      href: "/admin/configuracoes",
      label: "Prazos e dados",
      permission: "content.edit",
      steps: [
        "Em Configurações › Dados gerais ficam os prazos de cada tipo de pedido e os feriados.",
        "Em Configurações › Cobrança fica a chave Pix que recebe os pagamentos.",
        "Em Configurações › Numeração você escolhe de qual número os protocolos seguem.",
      ],
    },
  },
  "/admin/mensagens": {
    purpose:
      "O chat interno da equipe: conversa entre as pessoas da serventia, com foto, áudio e status (disponível, almoço, ausente).",
    steps: [
      "Escolha a pessoa na lista da esquerda e escreva embaixo.",
      "Use o clipe para enviar arquivo ou foto e o microfone para áudio.",
      "Troque o seu status no alto; no almoço, o chat fica travado até você voltar.",
    ],
    configure: {
      href: "/admin/configuracoes/notificacoes",
      label: "Avisos",
      permission: "content.edit",
      steps: [
        "Em Configurações › Notificações você escolhe como cada aviso chega (no painel, por e-mail).",
      ],
    },
  },
  "/admin/lgpd": {
    purpose:
      "Os requerimentos dos titulares de dados (LGPD): acesso, correção ou exclusão de dados pessoais, com prazo legal.",
    steps: [
      "Abra o requerimento pelo protocolo.",
      "Confira a identidade de quem pediu pelo documento anexado.",
      "Escreva a resposta e anexe o relatório, se houver; o titular é avisado.",
    ],
    configure: {
      href: "/admin/configuracoes/encarregado",
      label: "Encarregado (LGPD)",
      permission: "content.edit",
      steps: [
        "Em Configurações › Encarregado (LGPD) ficam o nome e o contato do encarregado, que aparecem no site.",
      ],
    },
  },
  "/admin/ouvidoria": {
    purpose:
      "As manifestações da ouvidoria (elogios, sugestões, reclamações e denúncias) feitas pelo site.",
    steps: [
      "Abra a manifestação pelo protocolo.",
      "Escreva a resposta ao cidadão; a nota interna fica só para a equipe.",
    ],
    configure: {
      href: "/admin/configuracoes/notificacoes",
      label: "Avisos",
      permission: "content.edit",
      steps: [
        "Em Configurações › Notificações você escolhe quem recebe o aviso de nova manifestação.",
      ],
    },
  },
  "/admin/agenda": {
    purpose:
      "Os agendamentos do site e do balcão, nas duas agendas: Atendimento do cartório e Atendimento com o tabelião.",
    steps: [
      "Escolha a agenda (cartório ou tabelião) nos cartões do alto.",
      "Clique no dia na faixa de datas; os horários agendados ficam destacados.",
      "Em cada agendamento: marque 'Atendido' ou 'Não compareceu', imprima o comprovante ou cancele (o cidadão é avisado).",
      "Num horário livre, dá para reservar pelo balcão.",
    ],
    configure: {
      href: "/admin/agenda/configuracao",
      label: "Configurar as agendas",
      permission: "channels.manage",
      steps: [
        "Escolha a agenda e use 'Sugerir horários' para montar a grade: quantas pessoas atendem, horário, almoço e tempo de cada serviço.",
        "Ajuste os horários de cada dia e marque os serviços que a agenda atende.",
        "Clique em Salvar no fim da página.",
      ],
    },
  },
  "/admin/atendimento": {
    purpose:
      "O atendimento online do site (chat com o cidadão), com fila, transferência entre setores e avaliação.",
    steps: [
      "Ligue ou desligue o chat do site pelo botão desta tela.",
      "Abra uma conversa da fila para responder; transfira para outro setor se precisar.",
      "Ao terminar, use 'Encerrar conversa'; o cidadão pode receber a transcrição por e-mail.",
    ],
  },
  "/admin/utilitarios/guias": {
    purpose:
      "As guias de transmissão de bens (ITIV/ITBI, ITCD, laudêmio): o requerimento que o tabelião assina e a parte leva ao fisco.",
    steps: [
      "Clique em 'Nova guia' e escolha o tipo.",
      "Preencha as partes, o bem e o valor; o imposto é calculado sozinho.",
      "Escolha quem assina e gere: assine digitalmente ou imprima para assinar à mão.",
    ],
    configure: {
      href: "/admin/utilitarios/guias/configuracao",
      label: "Leis, alíquotas e quem assina",
      permission: "content.edit",
      steps: [
        "Informe a lei e a alíquota do ITIV do município, a do laudêmio e o destinatário de cada fisco.",
        "Cadastre quem assina (nome, cargo, portaria/matrícula).",
        "Clique em Salvar.",
      ],
    },
  },
  "/admin/utilitarios/iss": {
    purpose:
      "A Declaração de ISS do mês ao fisco municipal, com os emolumentos, o livro e os relatórios anexos; pode publicar o boletim mensal junto.",
    steps: [
      "Clique em 'Nova declaração' e anexe os relatórios do sistema: os campos se preenchem sozinhos.",
      "Confira os valores lidos e marque a conferência.",
      "Escolha quem assina e gere; depois assine digitalmente ou imprima.",
      "Envie pelo site da prefeitura ou entregue na SEMUT e anote a data e o protocolo.",
    ],
    configure: {
      href: "/admin/utilitarios/iss/configuracao",
      label: "Configurar o ISS",
      permission: "content.edit",
      steps: [
        "Informe a alíquota, a lei municipal e o vencimento.",
        "Preencha os dados da prefeitura (CNPJ, endereço, prefeito, secretário) e da serventia.",
        "Escolha como a declaração chega à prefeitura (site ou SEMUT) e cadastre quem assina.",
      ],
    },
  },
  "/admin/utilitarios/livro-diario": {
    purpose:
      "Livro Diário Auxiliar da Receita e da Despesa, pelo texto do Código Nacional de Normas (Provimento CNJ nº 149/2023, arts. 185 a 195-D, com a redação do Provimento CNJ nº 259/2026, que revogou o Provimento nº 45/2015). As normas da Corregedoria do Estado continuam no que forem compatíveis (art. 195, parágrafo único).",
    steps: [
      "Abertura (art. 186): em Configurar, informe o número do livro e o de folhas; em 'Gerar PDF do livro', gere o termo de abertura. Cada página gerada depois recebe as folhas seguintes do livro, numeradas.",
      "Receita (art. 190): em 'Anexar produtividade', envie o relatório de um dia. A receita é lançada 'no dia da prática do ato', por especialidade, com o nº do ato, ou o livro e a folha, ou o protocolo, quando existente.",
      "Boletim mensal: no mesmo envio da produtividade, marque 'Enviar ao boletim mensal'. O boletim da Transparência abre já preenchido no mês; confira, marque 'Conferi os valores', assine se quiser e publique. As duas opções são facultativas: só o livro, só o boletim ou os dois. O relatório do mês inteiro vai só ao boletim. O botão 'Enviar o mês ao boletim' manda a soma dos dias já lançados.",
      "Despesa (art. 191-A): em 'Lançar despesa', informe a data, a categoria do § 1º e os elementos de identificação e comprovação, até o encerramento do mês em que se efetivou. Anexe o comprovante.",
      "Todo lançamento tem 'Editar' e 'Excluir' (fica guardado, com a justificativa) e um campo de explicação que sai no livro.",
      "Em 'Gerar PDF do livro': o dia, o mês (apuração do art. 192), o balanço anual (art. 193) ou os termos (art. 186). Assine digitalmente ou imprima.",
      "Livro cheio: gere o termo de encerramento, passe para o número seguinte em Configurar e gere o novo termo de abertura.",
    ],
    terms: [
      {
        term: "Colunas (art. 189)",
        meaning:
          "'O Livro Diário Auxiliar observará o modelo usual para a forma contábil e terá suas folhas divididas em colunas para anotação da data, da discriminação da receita e da despesa, além do valor respectivo, devendo, quando impresso em folhas soltas, encadernar-se tão logo encerrado.'",
      },
      {
        term: "Dia da prática do ato (art. 190, § 1º)",
        meaning:
          "Notas: o da lavratura e do encerramento do ato. Registros de imóveis, títulos e documentos e civil de pessoa jurídica: o do registro. Registro Civil das Pessoas Naturais: o do registro, para os atos não compensáveis; para os gratuitos, o do recebimento do pagamento feito pelo fundo de reembolso de atos gratuitos e fundo de renda mínima.",
      },
      {
        term: "O que é receita (art. 190, § 3º)",
        meaning:
          "Os emolumentos do regimento de custas, só na parte que é receita do próprio delegatário, pelos atos praticados. Ficam fora: depósitos para atos futuros, tributos recebidos por substituição tributária e valores devidos ao Estado, ao Tribunal de Justiça, a outras entidades e aos fundos. Por isso só os emolumentos do relatório de produtividade entram como receita; os fundos (FDJ, FRMP, FCRCPN, FPGE) e o ISSQN aparecem à parte.",
      },
      {
        term: "Despesas (art. 191-A, § 1º)",
        meaning:
          "'Poderão ser lançadas, entre outras': I locação; II obras e manutenção dos imóveis; III limpeza, segurança e terceirizados; IV móveis, equipamentos, sistemas e tecnologia; V acervo; VI materiais e insumos; VII despesas trabalhistas e previdenciárias dos prepostos; VIII planos coletivos de saúde; IX cursos; X ISS sobre a atividade, quando devido; XI assessoria jurídica; XII serviços técnicos especializados.",
      },
      {
        term: "O que não pode (art. 191-A, § 2º)",
        meaning:
          "'Não poderão ser lançadas despesas de natureza exclusivamente pessoal ou estranhas à prestação do serviço delegado.' O Código Nacional não trata do imposto de renda do delegatário como despesa. O Código de Normas do RN (art. 25, § 2º) diz: 'O Imposto de Renda devido pelo interino não é considerado como despesa da serventia.'",
      },
      {
        term: "Comprovantes (art. 191-A, § 3º)",
        meaning:
          "Conservados por no mínimo 5 anos, sem prejuízo de prazo maior previsto em lei, admitido o meio eletrônico com integridade, autenticidade e disponibilidade.",
      },
      {
        term: "Apuração do mês (art. 192)",
        meaning:
          "'Ao final de cada mês serão somadas, em separado, as receitas e as despesas da unidade de serviço extrajudicial, com a apuração do saldo líquido positivo ou negativo do período.'",
      },
      {
        term: "Balanço anual (art. 193)",
        meaning:
          "'Ao final de cada exercício será elaborado o balanço anual da unidade de serviço extrajudicial, com indicação das receitas, das despesas e do resultado líquido.' No RN: até 15 de janeiro, remetido à Corregedoria Geral de Justiça até 5 dias depois de concluído (CGJ/RN art. 62); livro visado pelo Juiz Corregedor Permanente até o 15º dia útil de fevereiro (art. 61, parágrafo único).",
      },
      {
        term: "Tratamento fiscal distinto (art. 193-A)",
        meaning:
          "O livro pode subsidiar a escrituração e a apuração tributária, sem virar escrituração fiscal (§ 1º). Usado para fins tributários, identificam-se as despesas com tratamento fiscal distinto do adotado para fins administrativos e correicionais (§ 2º).",
      },
      {
        term: "Interino (art. 194)",
        meaning:
          "Lança no livro a renda líquida excedente a 90,25% dos subsídios de ministro do STF que depositar à disposição do Tribunal de Justiça, com a data do depósito e a conta (I). Abate as despesas previstas em disposição legal ou infralegal (IV). Lança os depósitos no Justiça Aberta, até 15 de janeiro e 15 de julho (V; Provimento CNJ nº 24/2012, art. 2º). Periodicidade trimestral, salvo lei estadual (VI).",
      },
      {
        term: "Fiscalização (arts. 195-A a 195-D)",
        meaning:
          "A Corregedoria verifica a escrituração, os comprovantes e, quanto ao delegatário, o recolhimento mensal do imposto de renda, inclusive o carnê-leão (art. 195-B, § 1º). Abrange, em regra, os 12 meses anteriores à correição ou inspeção (§ 3º).",
      },
      {
        term: "Referências",
        meaning: `${REF_CN_149} ${REF_CN_259} ${REF_RN_156}`,
      },
    ],
    configure: {
      href: "/admin/utilitarios/livro-diario/configuracao",
      label: "Livro, folhas, especialidades e interino",
      permission: "daily-book.manage",
      steps: [
        "Informe o número do livro e o número de folhas (art. 186).",
        "Confira as especialidades pelo código do ato (ex.: 22 = Tabelionato de Notas, 23 = Registro Civil), conforme a tabela de emolumentos do Estado.",
        "Serventia vaga: marque a opção do interino, informe 90,25% do subsídio mensal de ministro do STF e a periodicidade (art. 194, VI).",
      ],
    },
  },
  "/admin/utilitarios/papel-seguranca": {
    purpose:
      "O classificador do papel de segurança (Provimento CGJ/RN nº 156/2016, arts. 59 e 60): os lotes recebidos, as folhas usadas e perdidas, o estoque e os ofícios à Corregedoria, com a planilha das folhas.",
    steps: [
      "Em 'Cadastrar lote', informe o tipo de papel e a primeira e a última folha (ex.: AB 000001 a AB 001000). Nota fiscal e gráfica são opcionais. Folhas antigas: marque 'Estoque que a serventia já tinha'.",
      "Não é preciso lançar todo dia. Durante o mês, lance só o que der errado, na hora: a folha inutilizada, avariada, extraviada ou subtraída, com o número dela.",
      "No fim de cada mês, lance o uso uma vez: 'Lançar uso ou ocorrência' › Utilizadas › 'Usei até a folha nº'. Olhe a primeira folha em branco na gaveta; a anterior é a última usada. Use a data do último dia do mês. O sistema baixa tudo até ela e pula as folhas já lançadas.",
      "Lance o uso dentro do próprio mês: a prestação de contas do trimestre conta pela data de cada lançamento. No começo do mês, um aviso lembra de lançar o uso do mês anterior.",
      "Errou? Todo lote, lançamento e ofício tem 'Editar' e 'Excluir'. Excluir pede a justificativa e não apaga do banco: o registro some da lista e fica guardado.",
      "Quando restarem 200 folhas de um tipo (o número é ajustável), aparece o aviso com o botão para solicitar um novo lote.",
      "No fim do mês com extravio, subtração ou avaria, e a cada trimestre, o aviso amarelo leva ao ofício pronto. Assine digitalmente ou imprima, baixe a planilha e anote o envio.",
    ],
    terms: [
      {
        term: "Utilizada",
        meaning:
          "A folha usada num ato que saiu certo (o traslado, a certidão, a etiqueta entregue).",
      },
      {
        term: "Inutilizada",
        meaning:
          "A folha que estragou na própria serventia por erro: impressão torta ou borrada, dado errado, ato refeito. Ela não sai da serventia: risque, guarde no classificador e lance com o número. Entra na prestação de contas do trimestre.",
      },
      {
        term: "Avariada",
        meaning:
          "A folha danificada por acidente antes de ser usada: molhou, rasgou, queimou, mofou. Lance com o número; vai no ofício do fim do mês à Corregedoria.",
      },
      {
        term: "Extraviada",
        meaning:
          "A folha que sumiu e ninguém sabe onde está (perdeu no balcão, na mudança, no malote). Lance com o número e conte como aconteceu; vai no ofício do fim do mês, para a Corregedoria publicar no DJe e ninguém usar aquela folha.",
      },
      {
        term: "Subtraída",
        meaning:
          "A folha furtada ou roubada. Registre o boletim de ocorrência, lance com o número e o B.O.; vai no ofício do fim do mês.",
      },
      {
        term: "Classificador",
        meaning:
          "A pasta (aqui, digital) com a requisição, a nota e o recebimento de cada lote e o controle das folhas usadas e do estoque (art. 60).",
      },
    ],
    configure: {
      href: "/admin/utilitarios/papel-seguranca/configuracao",
      label: "A quem vão os ofícios",
      permission: "security-paper.manage",
      steps: [
        "Confira o órgão (Corregedoria Geral de Justiça do Estado) e o tratamento do(a) Corregedor(a).",
        "Confira a norma do Estado citada nos ofícios; no RN, o Provimento nº 156/2016-CGJ/RN.",
        "Se a Corregedoria fixou um prazo para a prestação trimestral, informe o dia. Quem assina vem de Configurações › Quem assina.",
      ],
    },
  },
  "/admin/utilitarios/solicitacao-papeis": {
    purpose:
      "Os pedidos de papéis de segurança às empresas (traslado, certidão, apostila, etiquetas, ribbon), cada um no formulário da empresa, para assinar digitalmente ou imprimir.",
    steps: [
      "Na primeira vez, clique em 'Usar as empresas da ANOREG/RN' (IGB e M2) ou cadastre a sua em 'Nova empresa'.",
      "Em 'Novo pedido', escolha a empresa e informe as quantidades. Não está na lista? Use '+ Adicionar item novo'.",
      "Gere o pedido: assine digitalmente ou imprima. Se a empresa tem o formulário em Word, baixe-o já preenchido.",
      "Todo pedido tem 'Editar' e 'Excluir'. Anote o envio e o recebimento; ao receber, cadastre o lote no Papel de segurança.",
    ],
    configure: {
      href: "/admin/utilitarios/solicitacao-papeis/configuracao",
      label: "Dados do cartório para os pedidos",
      permission: "paper-orders.manage",
      steps: [
        "Confira o nome do cartório, o CNS, o responsável, o CPF e o CNPJ de faturamento.",
        "Confira o endereço, o CEP, o município, o telefone e o e-mail.",
        "Para mudar a empresa, os itens ou o formulário dela, abra a empresa e clique em Editar; para ler um formulário novo, envie o .docx e clique em 'Ler o modelo'.",
      ],
    },
  },
  "/admin/utilitarios/assinador": {
    purpose:
      "O assinador digital: assina PDFs com o certificado da serventia (A1 no sistema ou A3 no token), com QR de verificação.",
    steps: [
      "Escolha os PDFs e o tipo de certificado (A1 ou A3).",
      "No A1, escolha o certificado e digite a senha; no A3, conecte o token e escolha o certificado.",
      "Clique em Assinar; o documento assinado fica na lista, para baixar ou imprimir.",
    ],
    configure: {
      href: "/admin/configuracoes/certificados",
      label: "Certificados digitais",
      permission: "certificates.manage",
      steps: [
        "Em Configurações › Certificados digitais, envie o arquivo do certificado A1 (.pfx) e a senha.",
        "Escolha quem pode assinar com cada certificado.",
        "Para A3, instale o Assinador Veridia no computador (o botão de download aparece ao escolher A3).",
      ],
    },
  },
  "/admin/publicacoes": {
    purpose: "Os editais, avisos e notícias que aparecem no site da serventia.",
    steps: [
      "Em 'Nova publicação', escreva o título e o texto e anexe o arquivo, se houver.",
      "Confira a data da publicação e clique em Publicar.",
      "Para tirar do site, abra a publicação e use 'Arquivar'.",
    ],
  },
  "/admin/transparencia": {
    purpose:
      "A página de transparência do site: documentos (tabelas, relatórios) e o boletim mensal da arrecadação.",
    steps: [
      "Na aba Documentos, envie o PDF e publique.",
      "Na aba Boletim mensal, anexe o relatório de produtividade (os números se preenchem) ou digite-os.",
      "Confira, escolha se assina digitalmente e clique em Publicar. Para corrigir, edite e publique de novo; para tirar do site, use Excluir.",
    ],
    configure: {
      href: "/admin/configuracoes/certificados",
      label: "Certificados para assinar",
      permission: "certificates.manage",
      steps: [
        "A opção de mostrar arrecadação, despesas e saldo fica no alto do boletim mensal.",
        "Para assinar o boletim com A1, cadastre o certificado em Configurações › Certificados digitais.",
      ],
    },
  },
  "/admin/adequacao": {
    purpose:
      "O questionário de adequação ao Provimento do CNJ: cada seção pergunta o que a serventia já faz e gera as pendências.",
    steps: [
      "Abra a próxima seção e responda as perguntas.",
      "Salve; as pendências aparecem no resumo.",
      "Volte quando resolver uma pendência e atualize a resposta.",
    ],
  },
  "/admin/usuarios": {
    purpose:
      "As contas da equipe: quem acessa o painel, com qual cargo, e os convites.",
    steps: [
      "Em 'Criar conta', informe nome, e-mail e cargo; a pessoa recebe o link para criar a senha.",
      "Use 'Link de nova senha' (no menu da conta) para quem esqueceu a senha.",
      "Use 'Desativar acesso' para quem saiu da serventia (o histórico fica guardado).",
    ],
    configure: {
      href: "/admin/configuracoes/perfis",
      label: "Perfis e permissões",
      permission: "user.manage",
      steps: [
        "Em Configurações › Perfis e permissões, marque o que cada cargo pode fazer e ver no painel.",
        "A mudança vale para todas as pessoas daquele cargo.",
      ],
    },
  },
  "/admin/auditoria": {
    purpose:
      "O registro de tudo o que foi feito no painel, por quem e quando, com as faixas Urgente, Atenção e Análise.",
    steps: [
      "Comece pelos urgentes: abra, leia a explicação e marque como analisado.",
      "Filtre por pessoa ou por área para ver um histórico.",
      "Se precisar de explicação, envie uma notificação formal à pessoa (prazo de 24 horas).",
    ],
  },
  "/admin/configuracoes": {
    purpose:
      "As configurações da serventia, em três grupos: Serventia, Documentos e Equipe e acesso.",
    steps: [
      "Escolha o grupo no alto e depois a aba.",
      "Altere o que precisar e clique em Salvar no quadro que mudou.",
      "Cada serviço do painel também tem o botão 'Configurar', que leva direto à aba certa.",
    ],
  },
  "/admin/minha-conta": {
    purpose:
      "A sua conta: trocar a senha e o e-mail que recebe o código de acesso.",
    steps: [
      "Para trocar a senha, digite a atual e a nova duas vezes.",
      "Para trocar o e-mail do código, informe o novo e confirme com o código enviado a ele.",
    ],
  },
  "/admin/ajuda": {
    purpose:
      "Os cursos e vídeos que ensinam a usar o painel, tela por tela, com o seu progresso.",
    steps: [
      "Escolha um curso e assista aos vídeos na ordem.",
      "Cada vídeo assistido fica marcado; 'Continuar' leva de volta de onde parou.",
      "Em qualquer tela, 'Como usar esta tela' abre o vídeo daquela tela.",
    ],
  },
};

/** The help of the screen at `pathname`: the longest registered prefix. */
export function screenHelpFor(pathname: string | null): ScreenHelp | undefined {
  if (!pathname) return undefined;
  if (pathname === "/admin") return ENTRIES["/admin"];
  const match = Object.keys(ENTRIES)
    .filter(
      (prefix) =>
        prefix !== "/admin" &&
        (pathname === prefix || pathname.startsWith(`${prefix}/`)),
    )
    .sort((a, b) => b.length - a.length)[0];
  return match ? ENTRIES[match] : undefined;
}

/**
 * What goes to the Corregedoria, and when (decision of 11/11/2026): a "!"
 * of its own beside the ofícios and on the screen that generates them,
 * because "only when there is a loss" is the usual misunderstanding.
 */
/** The opening and closing terms of the book (CN art. 186). */
export const BOOK_TERMS_HELP: ScreenHelp = {
  purpose:
    "Todo livro administrativo tem começo e fim formais. O termo de abertura é a primeira folha do livro: declara o número do livro, a sua finalidade, a quantidade de folhas e que todas estão rubricadas. O termo de encerramento é a última: declara que o livro foi encerrado e até que folha foi escriturado. Ambos são assinados pelo delegatário (Código Nacional de Normas, art. 186).",
  steps: [
    "Em Configurar, informe o número do livro e a quantidade de folhas.",
    'Clique em "Gerar termo de abertura" antes do primeiro lançamento do livro. Assine digitalmente ou imprima e assine à mão.',
    'A partir daí, cada página gerada recebe as folhas seguintes, numeradas no alto ("Livro nº 1 · Folha 3").',
    'Quando as folhas acabarem, clique em "Gerar termo de encerramento". Depois, em Configurar, passe para o livro seguinte e gere o novo termo de abertura.',
  ],
  terms: [
    {
      term: "Texto da norma",
      meaning:
        '"Os livros previstos neste Capítulo serão abertos, numerados, autenticados e encerrados pelo delegatário [...]. O termo de abertura deverá conter o número do livro, o fim a que se destina, o número de folhas que contém, a declaração de que todas as suas folhas estão rubricadas e o fecho, com data, nome do delegatário e assinatura." (art. 186 e parágrafo único).',
    },
    { term: "Referência", meaning: REF_CN_149 },
  ],
  configure: {
    href: "/admin/utilitarios/livro-diario/configuracao",
    label: "Número do livro e de folhas",
    permission: "daily-book.manage",
    steps: ["Informe o número do livro e a quantidade de folhas."],
  },
};

/** How to fill in the excess calculator, field by field. */
export const EXCESS_CALCULATOR_HELP: ScreenHelp = {
  purpose:
    "A calculadora responde a uma pergunta: neste período, o interino tem valor a depositar para o Tribunal de Justiça? Preencha os passos de cima para baixo; o resultado aparece no passo 4 enquanto você digita.",
  steps: [
    'Passo 1, período: deixe "Trimestral", que é a regra nacional, e escolha o ano e o trimestre. Use "Mensal" apenas se a norma do Estado mandar apurar mês a mês (no Rio Grande do Norte, art. 27 do Código de Normas).',
    "Passo 2, teto: digite o subsídio mensal de ministro do STF, isto é, o valor cheio. A calculadora mostra os 90,25% (teto do mês) e multiplica pelos meses do período.",
    'Passo 3, valores: digite as receitas (emolumentos) e as despesas do período, ou clique em "Preencher com o livro" para trazer o que já foi lançado. A remuneração do próprio interino não entra nas despesas.',
    "Passo 4, resultado: veja a conta por extenso. Se houver excedente, a tela indica o valor a depositar e o atalho para lançar o depósito no livro.",
    "Salve o cálculo para ter a memória de cálculo em PDF, que pode ser assinada digitalmente ou impressa. Cálculos salvos podem ser editados ou excluídos (com justificativa).",
  ],
  terms: [
    {
      term: "Subsídio",
      meaning:
        "Remuneração mensal de ministro do Supremo Tribunal Federal, fixada em lei. Use o valor vigente no período calculado.",
    },
    {
      term: "Teto do período",
      meaning:
        "90,25% do subsídio, multiplicado pelo número de meses do período (três, no trimestre).",
    },
    {
      term: "Renda líquida",
      meaning: "Receitas menos despesas do período.",
    },
    {
      term: "Excedente",
      meaning:
        "Parte da renda líquida que ultrapassa o teto do período. Não pertence ao interino: é depositada à disposição do Tribunal de Justiça (art. 194, I).",
    },
    { term: "Referências", meaning: `${REF_CN_149} ${REF_RN_156}` },
  ],
};

/**
 * The interim's excess over 90,25% of the STF minister's pay, for a lay
 * reader, with fictitious examples (decision of 12/11/2026). Its own "!" on
 * the book, its settings and the calculator.
 */
export const INTERIM_EXCESS_HELP: ScreenHelp = {
  purpose:
    "Quando o cartório está vago (sem titular aprovado em concurso), quem responde por ele é o interino. Ele não é o dono do cartório: só o administra até o novo titular assumir. Por isso a lei limita quanto ele pode ganhar com o cartório: no máximo 90,25% do subsídio (o salário) de um ministro do Supremo Tribunal Federal. O que passar disso é o excedente e não fica com o interino: é depositado à disposição do Tribunal de Justiça (Código Nacional de Normas, art. 194).",
  steps: [
    "Some as receitas do período: os emolumentos dos atos.",
    "Tire as despesas do cartório que as normas permitem (folha dos funcionários, aluguel, energia, sistemas, material...). Não entram a remuneração do próprio interino nem o imposto de renda dele (no RN, art. 25, § 2º).",
    "O que sobrar é a renda líquida.",
    "Calcule o teto: 90,25% do subsídio mensal de ministro do STF. Se o período tiver mais de um mês, multiplique pelos meses.",
    "Compare: se a renda líquida passou do teto, a diferença é o excedente, que é depositado e lançado no Livro Diário Auxiliar com a data do depósito e a conta (art. 194, I). Se não passou, não há nada a depositar e a renda líquida fica com o interino.",
    "Período: a regra nacional soma o trimestre (art. 194, VI), salvo lei estadual com outro prazo. No RN, o Código de Normas manda recolher ao FDJ até o dia 10 do mês seguinte (arts. 19 e 27), mês a mês.",
    "A calculadora faz essa conta, pode puxar as receitas e despesas do livro, e guarda cada cálculo com PDF para assinar digitalmente ou imprimir, editar e excluir.",
  ],
  terms: [
    {
      term: "Exemplos",
      meaning:
        "Todos com valores fictícios: subsídio de ministro do STF de R$ 40.000,00, então o teto do mês é R$ 36.100,00 (90,25%).",
    },
    {
      term: "Exemplo 1: mês acima do teto",
      meaning:
        "Receitas R$ 80.000,00, despesas R$ 30.000,00: renda líquida R$ 50.000,00. Passou do teto em R$ 13.900,00 (50.000 - 36.100). O interino fica com R$ 36.100,00 e deposita R$ 13.900,00.",
    },
    {
      term: "Exemplo 2: mês abaixo do teto",
      meaning:
        "Receitas R$ 50.000,00, despesas R$ 25.000,00: renda líquida R$ 25.000,00. Não chegou ao teto de R$ 36.100,00: nada a depositar, e o interino fica com R$ 25.000,00.",
    },
    {
      term: "Exemplo 3: trimestre",
      meaning:
        "Renda líquida de R$ 40.000,00 em janeiro, R$ 5.000,00 em fevereiro e R$ 60.000,00 em março: soma R$ 105.000,00. O teto do trimestre é R$ 108.300,00 (36.100 × 3). Não passou: nada a depositar. Se a conta fosse mês a mês, só março (R$ 60.000,00) passaria do teto, em R$ 23.900,00.",
    },
    {
      term: "Exemplo 4: mês com prejuízo",
      meaning:
        "Receitas R$ 20.000,00, despesas R$ 26.000,00: resultado negativo de R$ 6.000,00. Nada a depositar. No trimestre, esse negativo diminui a soma dos três meses.",
    },
    {
      term: "Subsídio",
      meaning:
        "O salário mensal de um ministro do STF, fixado em lei. Quando ele mudar, atualize o valor na configuração do livro e na calculadora: cada cálculo guarda o valor usado.",
    },
    {
      term: "Referências",
      meaning: `${REF_CN_149} ${REF_CN_24} ${REF_RN_156}`,
    },
  ],
  configure: {
    href: "/admin/utilitarios/livro-diario/configuracao",
    label: "Interino, teto e periodicidade",
    permission: "daily-book.manage",
    steps: [
      "Marque 'Serventia vaga, respondida por interino', informe 90,25% do subsídio e a periodicidade (trimestral ou mensal).",
    ],
  },
};

export const PAPER_SENDING_HELP: ScreenHelp = {
  purpose:
    "O que enviar à Corregedoria e quando. São três obrigações diferentes do Provimento nº 156/2016-CGJ/RN: a prestação de contas vai sempre, a comunicação só quando acontece algo, e o classificador fica na serventia.",
  steps: [
    "Todo fim de trimestre: gere e envie a prestação de contas, mesmo que não tenha havido nenhuma avaria. O aviso amarelo aparece sozinho quando o trimestre termina.",
    "No fim de um mês em que houve avaria, extravio ou subtração: gere e envie a comunicação, com o número das folhas. O aviso vermelho aparece sozinho.",
    "Mês sem avaria, extravio ou subtração: não se envia nada naquele mês. Só lance o uso do mês ('Usei até a folha nº').",
    "Folha inutilizada (erro de impressão) não vai no ofício do mês: entra só na prestação do trimestre.",
    "Depois de enviar, anote a data e o protocolo ou o malote no ofício. Quem não presta contas no prazo fica impedido de requisitar papel novo (art. 60, § 2º).",
  ],
  terms: [
    {
      term: "Prestação de contas (art. 60, § 1º)",
      meaning:
        "Todo trimestre, sempre. Estoque inicial, recebidas, utilizadas, inutilizadas, avariadas, extraviadas, subtraídas e estoque final, com a numeração em anexo.",
    },
    {
      term: "Comunicação de extravio, subtração ou avaria (art. 59)",
      meaning:
        "Só quando acontece, no fim do mês do fato, com o número das folhas, para a Corregedoria publicar no DJe.",
    },
    {
      term: "Classificador (art. 60, caput)",
      meaning:
        "O controle da própria serventia (lotes, notas, uso e estoque). Não é enviado: fica guardado para a correição. Aqui, ele é a própria tela do Papel de segurança e o 'Relatório do classificador'.",
    },
  ],
};

ENTRIES["/admin/utilitarios/papel-seguranca/gerar"] = {
  ...PAPER_SENDING_HELP,
  configure: ENTRIES["/admin/utilitarios/papel-seguranca"]?.configure,
};

ENTRIES["/admin/utilitarios/livro-diario/excedente"] = INTERIM_EXCESS_HELP;

/** Every screen with help, for the test that keeps the links honest. */
export const SCREEN_HELP = ENTRIES;
