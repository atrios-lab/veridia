/**
 * What an entry of the audit trail means, in the office's words, for the
 * Auditoria screen and the notification PDF. The trail stores a code
 * ("service-request.status"); the most common ones read as a sentence, the
 * rest as their area, and an unknown one as the code itself.
 */
const EXACT: Record<string, string> = {
  "session.sign-in": "Entrou no painel",
  "session.sign-out": "Saiu do painel",
  "session.first-access": "Primeiro acesso (criou a senha)",
  "session.access-code": "Confirmou o código de acesso",
  "session.denied-tenant": "Tentou entrar no painel de outra serventia",
  "user.password-changed": "Trocou a senha",
  "user.create": "Cadastrou uma conta",
  "user.update": "Alterou uma conta",
  "user.deactivate": "Desativou uma conta",
  "user.reactivate": "Reativou uma conta",
  "service-request.delete": "Excluiu um protocolo",
  "service-request.status": "Mudou o andamento de um pedido",
  "service-request.signed-form-check":
    "Conferência do requerimento assinado enviado pelo site",
  "service-request.signed-form-returned":
    "Devolveu o requerimento assinado ao solicitante",
  "service-request.delivery-signed":
    "Assinou digitalmente um documento entregue",
  "service-request.delivery-rename": "Renomeou um documento entregue",
  "tax-guide.issue": "Emitiu uma guia de transmissão de bens",
  "tax-guide.update": "Corrigiu uma guia de transmissão de bens",
  "tax-guide.renumber": "Alterou o número de uma guia",
  "tax-guide.delete": "Excluiu uma guia de transmissão de bens",
  "iss-declaration.issue": "Gerou uma declaração de ISS",
  "iss-declaration.update": "Corrigiu uma declaração de ISS",
  "iss-declaration.remove": "Excluiu uma declaração de ISS da lista",
  "iss-declaration.renumber": "Alterou o número de uma declaração de ISS",
  "iss-declaration.checked":
    "Conferiu os valores lidos do relatório na declaração de ISS",
  "iss-declaration.file":
    "Registrou a entrega de uma declaração de ISS à prefeitura",
  "transparency.bulletin.iss": "Lançou o ISS no boletim mensal",
  "security-paper.lot-add": "Cadastrou um lote de papel de segurança",
  "security-paper.lot-update":
    "Alterou a nota, a gráfica ou as observações de um lote de papel de segurança",
  "security-paper.lot-void":
    "Excluiu um lote de papel de segurança (fica guardado)",
  "security-paper.lot-edit": "Editou um lote de papel de segurança",
  "security-paper.movement-edit": "Editou um lançamento de papel de segurança",
  "security-paper.report-edit":
    "Editou um ofício ou relatório do papel de segurança",
  "security-paper.report-remove":
    "Excluiu um ofício ou relatório do papel de segurança (fica guardado)",
  "rcpn.import.upload": "Enviou um arquivo para o índice do Registro Civil",
  "rcpn.import.publish": "Publicou registros no índice do Registro Civil",
  "rcpn.import.discard":
    "Descartou um arquivo enviado ao índice do Registro Civil",
  "attributions.file.upload": "Enviou um arquivo a uma atribuição",
  "attributions.file.remove":
    "Excluiu um arquivo de uma atribuição (fica guardado)",
  "rcpn.certidao.issue": "Emitiu uma certidão do Registro Civil",
  "rcpn.certidao.edit": "Corrigiu uma certidão do Registro Civil",
  "rcpn.certidao.attach": "Anexou a certidão assinada ou digitalizada",
  "rcpn.certidao.remove":
    "Excluiu uma certidão do Registro Civil (fica guardada)",
  "daily-book.import": "Anexou um relatório ao Livro Diário Auxiliar",
  "daily-book.entry-add": "Fez um lançamento no Livro Diário Auxiliar",
  "daily-book.entry-edit": "Editou um lançamento do Livro Diário Auxiliar",
  "daily-book.entry-remove":
    "Excluiu um lançamento do Livro Diário Auxiliar (fica guardado)",
  "daily-book.report-issue": "Gerou uma página do Livro Diário Auxiliar",
  "daily-book.report-edit": "Editou uma página do Livro Diário Auxiliar",
  "daily-book.bulletin-prepare":
    "Preparou o boletim mensal a partir do Livro Diário Auxiliar",
  "daily-book.excess-save": "Salvou um cálculo do excedente do interino",
  "daily-book.excess-edit": "Editou um cálculo do excedente do interino",
  "daily-book.excess-remove":
    "Excluiu um cálculo do excedente do interino (fica guardado)",
  "daily-book.report-remove":
    "Excluiu uma página do Livro Diário Auxiliar (fica guardada)",
  "daily-book.fcrcpn-save": "Lançou um repasse do FCRCPN",
  "daily-book.fcrcpn-edit": "Corrigiu um repasse do FCRCPN",
  "daily-book.fcrcpn-remove": "Excluiu um repasse do FCRCPN (fica guardado)",
  "daily-book.fcrcpn-none": "Declarou o semestre sem repasse do FCRCPN",
  "paper-supplier.create": "Cadastrou uma empresa de papéis de segurança",
  "paper-supplier.update": "Editou uma empresa de papéis de segurança",
  "paper-supplier.remove":
    "Excluiu uma empresa de papéis de segurança (fica guardada)",
  "paper-order.issue": "Gerou um pedido de papéis de segurança",
  "paper-order.update": "Editou um pedido de papéis de segurança",
  "paper-order.status":
    "Registrou o envio ou o recebimento de um pedido de papéis de segurança",
  "paper-order.remove":
    "Excluiu um pedido de papéis de segurança (fica guardado)",
  "security-paper.use": "Lançou folhas de papel de segurança utilizadas",
  "security-paper.spoil":
    "Lançou folhas de papel de segurança inutilizadas ou avariadas",
  "security-paper.loss":
    "Lançou folhas de papel de segurança extraviadas ou subtraídas",
  "security-paper.movement-void":
    "Excluiu um lançamento de papel de segurança (fica guardado)",
  "security-paper.report-issue":
    "Gerou um ofício ou relatório do papel de segurança",
  "security-paper.report-sent":
    "Registrou o envio de um ofício do papel de segurança à Corregedoria",
  "transparency.bulletin.checked":
    "Conferiu os valores lidos do relatório no boletim mensal",
  "signed-document.sign": "Assinou digitalmente um documento",
  "messenger.lunch-request": "Pediu para mudar o horário de almoço",
  "messenger.lunch-approve": "Aprovou o horário de almoço",
  "messenger.lunch-reject": "Recusou o horário de almoço pedido",
  "messenger.chat-off": "Desativou o chat interno de uma pessoa",
  "messenger.chat-on": "Reativou o chat interno de uma pessoa",
  "messenger.message-edit": "Editou uma mensagem interna",
  "messenger.message-delete": "Apagou uma mensagem interna",
  "messenger.conversation-clear": "Limpou uma conversa interna",
  "messenger.lunch-return": "Voltou do almoço e liberou o chat",
  "service-request.delivery-physical":
    "Enviou ao cliente documento físico digitalizado, sem assinatura digital",
  "service-request.delivery-held":
    "Anexou documento ao pedido para assinar antes de enviar ao cliente",
  "service-request.delivery-unsigned":
    "Enviou ao cliente documento sem assinatura digital, por escolha própria",
  "messenger.status-set": "Mudou o status de uma pessoa no chat",
  "access-hours.request": "Pediu para acessar o painel fora do horário",
  "access-hours.release": "Liberou o acesso ao painel fora do horário",
  "access-hours.deny": "Recusou o acesso ao painel fora do horário",
  "access-hours.revoke": "Retirou a liberação fora do horário",
  "office-settings.access-hours": "Mudou o horário de acesso ao painel",
  "signed-document.remove": "Retirou um documento assinado da lista",
  "signed-document.restore": "Devolveu um documento assinado à lista",
  "signed-document.file-purge": "Arquivo assinado saiu do sistema (6 meses)",
  "signing-certificate.add": "Cadastrou um certificado digital",
  "signing-certificate.disable": "Desativou um certificado digital",
  "signing-certificate.signers": "Alterou quem assina com um certificado",
  "office-settings.save": "Alterou uma configuração da serventia",
  "office-settings.attributions":
    "Alterou as atribuições da serventia (o que oferece e o regime de cada uma)",
  "office-settings.role-permissions": "Alterou as permissões dos cargos",
  "platform.two-step-off": "Átrios desligou a verificação em duas etapas",
  "platform.two-step-on": "Átrios religou a verificação em duas etapas",
  "office.two-step-off": "Desligou a verificação em duas etapas da serventia",
  "office.two-step-on": "Religou a verificação em duas etapas da serventia",
  "audit.notification": "Enviou uma notificação de auditoria",
  "audit.notification-answer": "Respondeu a uma notificação de auditoria",
  "audit.notification-close": "Encerrou uma notificação de auditoria",
  "agenda.settings": "Alterou as configurações da agenda",
  "appointment.attach": "Anexou documento a um agendamento",
  "appointment.attend": "Marcou um agendamento como atendido",
  "appointment.close-day": "Fechou a agenda de um dia",
  "appointment.correct": "Corrigiu um agendamento",
  "appointment.key-reissue": "Gerou nova chave de um agendamento",
  "appointment.no-show": "Marcou falta em um agendamento",
  "appointment.note": "Anotou em um agendamento",
  "appointment.office-attach": "Anexou documento da serventia a um agendamento",
  "appointment.remove": "Retirou um agendamento",
  "appointment.revert": "Desfez o atendimento de um agendamento",
  "chat.close": "Encerrou um atendimento online",
  "chat.settings": "Ligou ou desligou o chat do site",
  "chat.transfer": "Transferiu um atendimento online",
  "ombudsman.internal-note": "Anotou em uma manifestação da ouvidoria",
  "office-brand.save": "Alterou a identidade visual",
  "office-dpo.save": "Alterou o encarregado de dados (LGPD)",
  "office-pix.save": "Alterou a chave Pix",
  "office-pix.remove": "Retirou a chave Pix",
  "fee-table.items": "Alterou a tabela de emolumentos",
  "publication.create": "Criou uma publicação",
  "publication.update": "Alterou uma publicação",
  "publication.archive": "Arquivou uma publicação",
  "publication.delete": "Excluiu uma publicação",
  "publication.attachment-purge": "Anexo de publicação saiu do sistema",
  "request.status": "Mudou a situação de um pedido",
  "service-request.create": "Registrou um pedido de serviço",
  "service-request.edit": "Alterou um pedido de serviço",
  "service-request.amount": "Alterou o valor de um pedido",
  "service-request.deadline": "Alterou o prazo de um pedido",
  "service-request.attachment.delete": "Excluiu um anexo de pedido",
  "service-request.exemption-decision": "Decidiu um pedido de gratuidade",
  "service-request.key-reissue": "Gerou nova chave de acesso de um pedido",
  "service-request.print.comprovante": "Imprimiu o comprovante de um pedido",
  "service-request.requirement.register": "Registrou uma exigência",
  "service-request.requirement.edit": "Alterou uma exigência",
  "service-request.requirement.delete": "Excluiu uma exigência",
  "service-request.requirement.reply": "Respondeu em uma exigência",
  "service-request.requirement.fulfill": "Deu uma exigência por cumprida",
  "service-request.search-answer": "Respondeu a uma busca",
  "transparency.bulletin.publish": "Publicou um boletim de transparência",
  "transparency.bulletin.remove": "Excluiu um boletim de transparência",
  "transparency.document.create": "Criou um documento de transparência",
  "transparency.document.publish": "Publicou um documento de transparência",
  "transparency.document.unpublish":
    "Despublicou um documento de transparência",
  "transparency.document.delete": "Excluiu um documento de transparência",
  "user.delete": "Excluiu uma conta",
  "user.invite": "Convidou uma pessoa (nova conta)",
  "user.invite-resend": "Reenviou um convite",
  "user.email-change-requested": "Pediu troca de e-mail",
  "user.email-changed": "Trocou o e-mail de uma conta",
  "user.password-reset-link-issued": "Gerou link para nova senha",
  "user.password-reset-request": "Pediu nova senha para uma conta",
  "user.password-reset-self-request": "Pediu nova senha (a própria)",
  "cohort.join": "Entrou por link de turma",
  "course.certificate.issue": "Emitiu certificado do treinamento",
};

const AREAS: Record<string, string> = {
  transparency: "Transparência",
  "office-dpo": "Encarregado de dados",
  "service-request": "Pedidos de serviço",
  pedidos: "Pedidos de serviço",
  appointment: "Agenda",
  agenda: "Agenda",
  "data-rights": "LGPD",
  lgpd: "LGPD",
  ombudsman: "Ouvidoria",
  ouvidoria: "Ouvidoria",
  chat: "Atendimento online",
  atendimento: "Atendimento online",
  "tax-guide": "Guias de transmissão de bens",
  "iss-declaration": "Declaração de ISS",
  "security-paper": "Papel de segurança",
  "paper-supplier": "Solicitação de papéis de segurança",
  "daily-book": "Livro Diário Auxiliar",
  "paper-order": "Solicitação de papéis de segurança",
  publication: "Publicações",
  publicacoes: "Publicações",
  "fee-table": "Tabela de emolumentos",
  course: "Treinamento",
  cohort: "Turmas",
  adequacao: "Adequação ao Provimento",
  "compliance-intake": "Adequação ao Provimento",
  user: "Usuários",
  session: "Acesso ao painel",
  "office-settings": "Configurações",
  "office-pix": "Cobrança",
  "office-brand": "Identidade visual",
  "signed-document": "Assinador digital",
  "signing-certificate": "Certificados digitais",
  audit: "Auditoria",
  platform: "Átrios",
};

export function auditActionLabel(code: string): string {
  const exact = EXACT[code];
  if (exact) return exact;
  const [area, ...rest] = code.split(".");
  const name = AREAS[area];
  return name ? `${name}: ${rest.join(".") || "ação"}` : code;
}

/**
 * The default legal basis of a notification, editable before it goes out.
 * Every provision quoted is in force and reads as written here.
 */
export const DEFAULT_LEGAL_BASIS = [
  "Constituição Federal, art. 5º, LV: aos acusados em geral são assegurados o contraditório e a ampla defesa, razão pela qual se oportuniza a presente manifestação antes de qualquer providência.",
  "Lei nº 8.935/1994, arts. 20 e 21: os prepostos são contratados pelo titular sob o regime da legislação do trabalho, e o gerenciamento administrativo dos serviços, inclusive o estabelecimento de normas, condições e obrigações relativas às funções dos prepostos, é da responsabilidade exclusiva do titular.",
  "Consolidação das Leis do Trabalho, art. 2º: cabe ao empregador dirigir a prestação pessoal de serviço.",
  "Lei nº 13.709/2018 (LGPD), arts. 37 e 46: o controlador mantém registro das operações de tratamento de dados pessoais e adota medidas de segurança aptas a protegê-los de acessos não autorizados e de situações ilícitas.",
].join("\n\n");

/** Hours the notified person has to answer. */
export const ANSWER_HOURS = 24;

/* ------------------------------------------------- in a layperson's words */

/**
 * What each act means, for someone who has never seen the system from the
 * inside (decision of 11/11/2026): the audit screen and its PDF show this
 * line under the act, never a code.
 */
const EXPLANATIONS: Record<string, string> = {
  "session.sign-in": "A pessoa entrou no painel com e-mail e senha.",
  "session.sign-out": "A pessoa saiu do painel.",
  "session.first-access":
    "A pessoa abriu o convite recebido por e-mail e criou a própria senha.",
  "session.access-code":
    "A pessoa digitou o código enviado ao e-mail dela para concluir a entrada no painel (verificação em duas etapas).",
  "session.denied-tenant":
    "Alguém tentou entrar no painel desta serventia com uma conta de outra serventia, e o sistema barrou.",
  "user.create": "Uma conta nova foi criada para alguém usar o painel.",
  "user.invite":
    "Foi enviado um convite por e-mail para uma pessoa criar a senha e entrar no painel.",
  "user.update": "Os dados ou o cargo de uma conta foram alterados.",
  "user.deactivate":
    "Uma conta foi desativada: a pessoa não consegue mais entrar no painel.",
  "user.reactivate": "Uma conta desativada voltou a poder entrar no painel.",
  "user.delete": "Uma conta foi excluída do painel.",
  "user.email-changed": "O e-mail de uma conta foi trocado.",
  "user.password-reset-link-issued":
    "Foi gerado um link para a pessoa criar uma senha nova.",
  "office-settings.attributions":
    "A serventia marcou as atribuições que oferece e, em cada uma, se responde o delegado, um interino ou um interventor. Isso muda o que o site oferece ao cidadão e o que o painel mostra em Atribuições.",
  "office-settings.save":
    "Uma configuração da serventia foi alterada (dados do site, horários, numeração, notificações e afins).",
  "office-settings.role-permissions":
    "O Tabelião/Registrador mudou o que cada cargo pode ver e fazer no painel.",
  "office-pix.save":
    "A chave Pix da serventia, para onde vão os pagamentos, foi cadastrada ou trocada.",
  "office-pix.remove": "A chave Pix da serventia foi retirada.",
  "office-brand.save": "As cores ou os logotipos do site foram alterados.",
  "office-dpo.save":
    "Os dados do encarregado de proteção de dados (LGPD) foram alterados.",
  "service-request.create": "Um pedido de serviço foi registrado.",
  "service-request.status":
    "O andamento de um pedido mudou (por exemplo: em análise, pronto, entregue).",
  "service-request.signed-form-check":
    "O sistema leu o requerimento assinado enviado pelo solicitante: aceito (requerimento deste protocolo com assinatura digital) ou enviado para conferência da serventia (foto, escaneado ou sem assinatura digital reconhecida).",
  "service-request.signed-form-returned":
    "A serventia conferiu o requerimento enviado pelo solicitante e o devolveu, com o motivo, pedindo outro arquivo. O solicitante foi avisado por e-mail.",
  "request.status": "O andamento de um pedido mudou.",
  "service-request.edit": "Os dados de um pedido foram corrigidos.",
  "service-request.amount": "O valor cobrado num pedido foi alterado.",
  "service-request.deadline": "O prazo de um pedido foi alterado.",
  "service-request.delete": "Um pedido foi excluído do sistema.",
  "service-request.attachment.delete":
    "Um arquivo enviado num pedido foi excluído.",
  "service-request.exemption-decision":
    "Foi decidido um pedido de gratuidade (isenção de pagamento).",
  "service-request.key-reissue":
    "Foi gerada uma nova chave de acesso para o cidadão acompanhar o pedido.",
  "service-request.requirement.register":
    "Foi registrada uma exigência: algo que o cidadão precisa enviar ou corrigir.",
  "service-request.requirement.delete": "Uma exigência foi excluída.",
  "service-request.delivery-signed":
    "Um documento entregue ao cidadão foi assinado digitalmente.",
  "service-request.delivery-rename":
    "O nome de um documento entregue ao cidadão foi alterado.",
  "tax-guide.issue":
    "Uma guia de transmissão de bens (imposto ou certidão de um imóvel) foi emitida.",
  "tax-guide.update": "Uma guia de transmissão de bens foi corrigida.",
  "tax-guide.renumber":
    "O número de uma guia de transmissão de bens foi trocado.",
  "tax-guide.delete":
    "Uma guia de transmissão de bens foi excluída e o número dela ficou livre.",
  "iss-declaration.issue":
    "Foi gerada a declaração mensal de ISS ao fisco municipal, com os emolumentos do mês e o livro do caixa anexo.",
  "iss-declaration.update":
    "Os valores de uma declaração de ISS foram corrigidos: confira a competência, os emolumentos e a alíquota.",
  "iss-declaration.remove":
    "Uma declaração de ISS saiu da lista. O registro continua guardado, e o número dela ficou livre.",
  "iss-declaration.checked":
    "Os valores que o sistema leu dos relatórios (produtividade, valores tributários) foram conferidos por esta pessoa antes de a declaração ser gerada.",
  "iss-declaration.renumber":
    "O número de uma declaração de ISS foi trocado, para seguir a contagem da serventia.",
  "iss-declaration.file":
    "Foi anotado quando a declaração de ISS chegou à prefeitura (pelo site ou na SEMUT) e o número do protocolo.",
  "transparency.bulletin.checked":
    "Os valores do boletim mensal que o sistema leu do relatório foram conferidos por esta pessoa antes de publicar.",
  "transparency.bulletin.iss":
    "O ISS de uma declaração foi lançado no boletim mensal da página de transparência.",
  "security-paper.lot-add":
    "Um lote de papel de segurança entrou no classificador, com a numeração da primeira e da última folha.",
  "security-paper.lot-update":
    "A nota fiscal, a gráfica, a requisição ou as observações de um lote foram alteradas. A numeração não muda.",
  "security-paper.lot-void":
    "Um lote foi excluído, com justificativa. Ele continua guardado no classificador, fora do estoque.",
  "security-paper.lot-edit":
    "Os dados de um lote foram editados (tipo, numeração, datas ou nota fiscal).",
  "security-paper.movement-edit":
    "Um lançamento de papel de segurança foi editado (ocorrência, folhas, data ou referência).",
  "security-paper.report-edit":
    "Um ofício ou relatório do papel de segurança foi editado. O número continua o mesmo.",
  "security-paper.report-remove":
    "Um ofício ou relatório do papel de segurança foi excluído, com justificativa. Ele continua guardado.",
  "rcpn.import.upload":
    "Um arquivo do sistema do registro civil foi enviado ao painel e lido. Os registros só entram no índice depois da conferência e da publicação.",
  "rcpn.import.publish":
    "Registros lidos de um arquivo foram conferidos e publicados no índice do Registro Civil, que alimenta a pesquisa e a consulta do site. Registros já existentes só foram substituídos quando a pessoa escolheu.",
  "rcpn.import.discard":
    "Um arquivo enviado ao índice do Registro Civil foi descartado sem publicar. O arquivo foi apagado do painel; nada mudou no índice.",
  "attributions.file.upload":
    "Um arquivo (livro, índice, remessa de central, modelo ou documento) foi enviado à área de uma atribuição e guardado como veio.",
  "attributions.file.remove":
    "Um arquivo de uma atribuição foi excluído da lista, com justificativa. Ele continua guardado e aparece na auditoria.",
  "rcpn.certidao.issue":
    "Uma certidão de nascimento, casamento ou óbito foi emitida pelo painel, com os dados conferidos com o livro e o selo colado do lote do TJRN.",
  "rcpn.certidao.edit":
    "Uma certidão emitida foi corrigida (erro de digitação, selo ou assinante), com justificativa. O índice do Registro Civil não muda.",
  "rcpn.certidao.attach":
    "A certidão assinada à mão e digitalizada, ou a assinada digitalmente, foi anexada à certidão emitida.",
  "rcpn.certidao.remove":
    "Uma certidão emitida foi excluída, com justificativa. Ela continua guardada e aparece na auditoria.",
  "daily-book.import":
    "Um relatório de produtividade foi anexado e os atos lidos foram lançados como receita no Livro Diário Auxiliar.",
  "daily-book.entry-add":
    "Uma receita ou uma despesa foi lançada no Livro Diário Auxiliar.",
  "daily-book.entry-edit":
    "Um lançamento do Livro Diário Auxiliar foi corrigido (valor, data, categoria ou explicação).",
  "daily-book.entry-remove":
    "Um lançamento do Livro Diário Auxiliar foi excluído, com justificativa. Ele continua guardado.",
  "daily-book.report-issue":
    "Foi gerada a página do dia, do mês ou o balanço anual do Livro Diário Auxiliar.",
  "daily-book.report-edit":
    "Uma página do Livro Diário Auxiliar foi editada ou refeita com os lançamentos atuais.",
  "daily-book.bulletin-prepare":
    "Levou os valores dos relatórios de produtividade do mês para o formulário do boletim mensal, para conferir e publicar.",
  "daily-book.excess-save":
    "Foi salvo um cálculo do excedente do interino ao teto de 90,25% do subsídio de ministro do STF (art. 194).",
  "daily-book.excess-edit": "Um cálculo do excedente do interino foi alterado.",
  "daily-book.excess-remove":
    "Um cálculo do excedente do interino foi excluído, com justificativa. Ele continua guardado.",
  "daily-book.report-remove":
    "Uma página do Livro Diário Auxiliar foi excluída, com justificativa. Ela continua guardada.",
  "daily-book.fcrcpn-save":
    "Foi lançado um repasse do FCRCPN (compensação dos atos gratuitos do Registro Civil), que entra no Justiça Aberta em Receita terceiros: outros, do Registro Civil das Pessoas Naturais.",
  "daily-book.fcrcpn-edit":
    "Um repasse do FCRCPN foi corrigido (data, valor recebido, imposto retido ou quem pagou).",
  "daily-book.fcrcpn-remove":
    "Um repasse do FCRCPN foi excluído, com justificativa. Ele continua guardado.",
  "daily-book.fcrcpn-none":
    "Foi declarado que não houve repasse do FCRCPN no semestre, ou essa declaração foi desfeita.",
  "paper-supplier.create":
    "Uma empresa fornecedora de papéis de segurança foi cadastrada, com os itens que vende.",
  "paper-supplier.update":
    "Os dados, os itens ou o modelo de formulário de uma empresa fornecedora foram editados.",
  "paper-supplier.remove":
    "Uma empresa fornecedora foi excluída da lista, com justificativa. Os pedidos antigos continuam guardados.",
  "paper-order.issue":
    "Foi gerado um pedido de papéis de segurança a uma empresa, com as quantidades.",
  "paper-order.update": "Um pedido de papéis de segurança foi editado.",
  "paper-order.status":
    "Foi anotado quando o pedido foi enviado à empresa ou quando o material chegou.",
  "paper-order.remove":
    "Um pedido de papéis de segurança foi excluído da lista, com justificativa. Ele continua guardado.",
  "security-paper.use":
    "Folhas de papel de segurança foram baixadas do estoque por uso em atos.",
  "security-paper.spoil":
    "Folhas de papel de segurança foram inutilizadas ou avariadas. Avaria é comunicada à Corregedoria no fim do mês.",
  "security-paper.loss":
    "Folhas de papel de segurança foram extraviadas ou subtraídas. O fato é comunicado à Corregedoria no fim do mês, com a numeração.",
  "security-paper.movement-void":
    "Um lançamento de papel de segurança foi excluído, com justificativa. Ele continua guardado e as folhas voltam ao estoque.",
  "security-paper.report-issue":
    "Foi gerado um ofício à Corregedoria (extravio ou prestação de contas) ou o relatório do classificador. O conteúdo fica guardado como foi gerado.",
  "security-paper.report-sent":
    "Foi anotado quando o ofício chegou à Corregedoria e o número do protocolo ou do malote.",
  "signed-document.sign":
    "Um documento foi assinado digitalmente com certificado ICP-Brasil.",
  "signed-document.remove":
    "Um documento assinado foi retirado da lista; o registro da assinatura continua.",
  "signed-document.restore": "Um documento assinado voltou para a lista.",
  "signing-certificate.add":
    "Um certificado digital (A1) foi cadastrado para assinar documentos.",
  "signing-certificate.disable": "Um certificado digital foi desativado.",
  "signing-certificate.signers":
    "Foi alterado quem pode assinar com um certificado digital.",
  "appointment.remove": "Um agendamento foi excluído.",
  "appointment.correct": "Os dados de um agendamento foram corrigidos.",
  "appointment.note": "Foi feita uma anotação num agendamento.",
  "publication.create": "Uma publicação (edital, aviso, notícia) foi criada.",
  "publication.update": "Uma publicação foi alterada.",
  "publication.archive": "Uma publicação saiu do site e foi arquivada.",
  "publication.delete": "Uma publicação foi excluída.",
  "transparency.document.delete": "Um documento de transparência foi excluído.",
  "transparency.bulletin.remove":
    "Um boletim mensal saiu do site e da lista. O registro continua guardado; publicar o mês de novo o traz de volta corrigido.",
  "office.two-step-off":
    "A verificação em duas etapas do painel foi desligada pela própria serventia (por exemplo, o código não chegava por e-mail): todos entram só com a senha até ela ser ligada de novo.",
  "office.two-step-on":
    "A verificação em duas etapas do painel foi ligada de novo pela própria serventia.",
  "platform.two-step-off":
    "A Átrios desligou a verificação em duas etapas desta serventia.",
  "platform.two-step-on":
    "A Átrios religou a verificação em duas etapas desta serventia.",
  "messenger.lunch-request":
    "A pessoa pediu um horário de almoço (até 1 hora por dia). Ele só vale depois que o Tabelião/Registrador aprovar.",
  "messenger.lunch-approve":
    "O Tabelião/Registrador aprovou o horário de almoço pedido; nesse horário a pessoa aparece como em almoço nas mensagens internas.",
  "messenger.lunch-reject":
    "O Tabelião/Registrador recusou o horário de almoço pedido.",
  "messenger.chat-off":
    "O Tabelião/Registrador desligou as mensagens internas de uma pessoa: ela não envia nem recebe mensagens.",
  "messenger.chat-on":
    "O Tabelião/Registrador religou as mensagens internas de uma pessoa.",
  "messenger.message-edit":
    "A pessoa corrigiu uma mensagem que tinha enviado no chat interno. O texto original continua guardado para o Tabelião/Registrador.",
  "messenger.message-delete":
    "A pessoa apagou uma mensagem que tinha enviado no chat interno. Ela some da conversa, mas continua guardada para o Tabelião/Registrador.",
  "messenger.conversation-clear":
    "A pessoa limpou uma conversa do chat interno: as mensagens somem da tela das duas pessoas, e o Tabelião/Registrador continua com o histórico.",
  "service-request.delivery-held":
    "O documento foi anexado ao pedido sem assinatura digital e ficou retido: o cliente só o vê depois de assinado na plataforma.",
  "service-request.delivery-unsigned":
    "A pessoa escolheu enviar ao cliente um documento sem assinatura digital, assim mesmo. Confira se era o caso.",
  "service-request.delivery-physical":
    "O documento enviado ao cliente não tinha assinatura digital, e a pessoa confirmou que é um documento desmaterializado: assinado à mão no papel e digitalizado.",
  "messenger.lunch-return":
    "No horário de almoço o chat interno fica bloqueado; a pessoa declarou que voltou do almoço ou do descanso e liberou o chat antes do fim do horário.",
  "messenger.status-set":
    'O Tabelião/Registrador mudou o status de uma pessoa no chat interno (por exemplo, um "Ocupado" que já passava de 40 minutos).',
  "access-hours.request":
    "Fora do horário de acesso, a pessoa pediu ao Tabelião/Registrador para usar o painel, dizendo qual demanda precisava acompanhar.",
  "access-hours.release":
    "O Tabelião/Registrador liberou uma pessoa para usar o painel fora do horário, só naquele dia ou até retirar a liberação.",
  "access-hours.deny":
    "O Tabelião/Registrador recusou o pedido de uma pessoa para usar o painel fora do horário.",
  "access-hours.revoke":
    "O Tabelião/Registrador retirou a liberação de uma pessoa para usar o painel fora do horário.",
  "office-settings.access-hours":
    "O Tabelião/Registrador mudou o horário em que o painel fica aberto para a equipe.",
  "audit.notification":
    "O Tabelião/Registrador enviou uma notificação pedindo explicações sobre atos registrados.",
  "audit.notification-answer":
    "A pessoa notificada respondeu à notificação de auditoria.",
  "audit.notification-close":
    "O Tabelião/Registrador encerrou uma notificação de auditoria.",
};

const AREA_EXPLANATIONS: Record<string, string> = {
  "service-request": "Ato feito num pedido de serviço.",
  appointment: "Ato feito num agendamento.",
  agenda: "Ato feito na agenda de atendimentos.",
  chat: "Ato feito no atendimento online (chat do site).",
  ombudsman: "Ato feito numa manifestação da ouvidoria.",
  "data-rights": "Ato feito num requerimento de dados pessoais (LGPD).",
  publication: "Ato feito nas publicações do site.",
  transparency: "Ato feito na área de transparência do site.",
  "tax-guide": "Ato feito numa guia de transmissão de bens.",
  "iss-declaration": "Ato feito numa declaração de ISS ao fisco municipal.",
  "security-paper":
    "Ato feito no controle do papel de segurança (lotes, uso, extravios e ofícios à Corregedoria).",
  "paper-supplier":
    "Ato feito no cadastro das empresas de papéis de segurança.",
  "daily-book":
    "Ato feito no Livro Diário Auxiliar da Receita e da Despesa (receitas, despesas e páginas geradas).",
  "paper-order": "Ato feito num pedido de papéis de segurança a uma empresa.",
  user: "Ato feito numa conta de acesso ao painel.",
  session: "Entrada ou saída do painel.",
  course: "Ato feito no treinamento.",
  tutorial: "Ato feito nos vídeos de treinamento.",
  "signed-document": "Ato feito no assinador digital.",
  "signing-certificate": "Ato feito nos certificados digitais.",
};

export function auditActionExplanation(code: string): string {
  if (EXPLANATIONS[code]) return EXPLANATIONS[code];
  const area = code.split(".")[0];
  if (/(^|[.-])(delete|remove|detach)($|[.-])/.test(code)) {
    return "Algo foi excluído ou retirado do sistema.";
  }
  return AREA_EXPLANATIONS[area] ?? "Ato registrado no painel.";
}

/** Settings keys, as the office calls them. */
const SETTINGS: Record<string, string> = {
  "office-alerts": "configuração de notificações",
  "office-access-codes": "verificação em duas etapas",
  "office-role-permissions": "permissões dos cargos",
  "office-numbering": "numeração dos documentos",
  "platform-access-policy": "liberação de acesso",
  "office-identification": "identificação da serventia",
  "office-contact": "atendimento e contato",
  "office-holidays": "feriados",
  "office-deadline": "prazos",
};

const NUMBERED: Record<string, string> = {
  guia: "guias",
  notificacao: "notificações",
  "declaracao-iss": "declarações de ISS",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERIFICATION = /^[0-9A-Z]{12}$/;

/**
 * The act's target in words: protocol numbers, codes and names stay;
 * internal ids and setting keys become what they are, in Portuguese, or
 * go when they mean nothing to a reader.
 */
export function targetInWords(
  targetType: string,
  target: string | null | undefined,
): string {
  if (!target) return "";
  if (targetType === "tenant") return "";
  if (targetType === "tenant-content") {
    const [key, kind, year] = target.split(":");
    if (key === "office-numbering" && kind) {
      return `numeração das ${NUMBERED[kind] ?? kind}${year ? ` de ${year}` : ""}`;
    }
    return SETTINGS[key] ?? "configuração da serventia";
  }
  const parts = target
    .split(" · ")
    .map((part) => part.trim())
    .filter((part) => part && !UUID.test(part));
  if (targetType === "signed-document") {
    return parts
      .map((part) =>
        VERIFICATION.test(part)
          ? `código ${part.slice(0, 4)}-${part.slice(4, 8)}-${part.slice(8)}`
          : part,
      )
      .join(" · ");
  }
  return parts.join(" · ");
}
