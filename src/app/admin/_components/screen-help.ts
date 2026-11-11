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

/** Every screen with help, for the test that keeps the links honest. */
export const SCREEN_HELP = ENTRIES;
