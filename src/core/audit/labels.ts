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
  "service-request.delivery-signed":
    "Assinou digitalmente um documento entregue",
  "service-request.delivery-rename": "Renomeou um documento entregue",
  "tax-guide.issue": "Emitiu uma guia de recolhimento",
  "tax-guide.update": "Corrigiu uma guia de recolhimento",
  "tax-guide.renumber": "Alterou o número de uma guia",
  "tax-guide.delete": "Excluiu uma guia de recolhimento",
  "signed-document.sign": "Assinou digitalmente um documento",
  "signed-document.file-purge": "Arquivo assinado saiu do sistema (6 meses)",
  "signing-certificate.add": "Cadastrou um certificado digital",
  "signing-certificate.disable": "Desativou um certificado digital",
  "signing-certificate.signers": "Alterou quem assina com um certificado",
  "office-settings.save": "Alterou uma configuração da serventia",
  "office-settings.role-permissions": "Alterou as permissões dos cargos",
  "platform.two-step-off": "Átrios desligou a verificação em duas etapas",
  "platform.two-step-on": "Átrios religou a verificação em duas etapas",
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
  "tax-guide": "Guias de recolhimento",
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
