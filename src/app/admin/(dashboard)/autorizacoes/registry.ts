import "server-only";
import {
  deleteAttachmentAction as a41,
  withdrawComplianceDoneAction as a42,
} from "@/app/admin/(dashboard)/adequacao/actions.ts";
import { removeAppointmentAction as a7 } from "@/app/admin/(dashboard)/agenda/actions.ts";
import { removeAttributionFileAction as a6 } from "@/app/admin/(dashboard)/atribuicoes/actions.ts";
import { disableCertificate as a14 } from "@/app/admin/(dashboard)/configuracoes/certificados/actions.ts";
import { removePixKey as a18 } from "@/app/admin/(dashboard)/configuracoes/cobranca/actions.ts";
import { deletePersonAction as a17 } from "@/app/admin/(dashboard)/configuracoes/equipe/actions.ts";
import { removeIssued as a16 } from "@/app/admin/(dashboard)/configuracoes/numeracao/actions.ts";
import { changeSectorAction as a15 } from "@/app/admin/(dashboard)/configuracoes/setores/actions.ts";
import { deleteAttachmentAction as a43 } from "@/app/admin/(dashboard)/lgpd/[protocolo]/actions.ts";
import {
  deleteAttachmentAction as a11,
  deleteRequestAction as a12,
  deleteRequirementAction as a13,
} from "@/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts";
import { deactivateServiceRequestsAction as a10 } from "@/app/admin/(dashboard)/pedidos/actions.ts";
import {
  deletePublicationAction as a44,
  archivePublicationAction as a45,
} from "@/app/admin/(dashboard)/publicacoes/actions.ts";
import {
  hideImportAction as a46,
  purgeImportFileAction as a47,
} from "@/app/admin/(dashboard)/rcpn/actions.ts";
import { removeCertidaoAction as a48 } from "@/app/admin/(dashboard)/rcpn/certidoes/actions.ts";
import { cancelHabilitacaoAction as a49 } from "@/app/admin/(dashboard)/rcpn/habilitacao/actions.ts";
import {
  deleteDocumentAction as a39,
  removeBulletinAction as a40,
} from "@/app/admin/(dashboard)/transparencia/actions.ts";
import {
  deactivateAccount as a8,
  deleteAccount as a9,
} from "@/app/admin/(dashboard)/usuarios/actions.ts";
import { setDocumentRemoved as a26 } from "@/app/admin/(dashboard)/utilitarios/assinador/actions.ts";
import {
  removeAction as a33,
  dismissRequestAction as a34,
} from "@/app/admin/(dashboard)/utilitarios/base-juridica/actions.ts";
import {
  removeActAction as a31,
  removeClosingAction as a32,
} from "@/app/admin/(dashboard)/utilitarios/censec/actions.ts";
import {
  deleteGuideAction as a24,
  withdrawGuideStatusAction as a25,
} from "@/app/admin/(dashboard)/utilitarios/guias/actions.ts";
import { removeIssDeclaration as a27 } from "@/app/admin/(dashboard)/utilitarios/iss/actions.ts";
import {
  removeEntry as a35,
  removeReport as a36,
} from "@/app/admin/(dashboard)/utilitarios/livro-diario/actions.ts";
import { removeExcess as a37 } from "@/app/admin/(dashboard)/utilitarios/livro-diario/excedente/actions.ts";
import { removeFcrcpn as a38 } from "@/app/admin/(dashboard)/utilitarios/livro-diario/justica-aberta/actions.ts";
import {
  voidLot as a21,
  voidMovement as a22,
  removeReport as a23,
} from "@/app/admin/(dashboard)/utilitarios/papel-seguranca/actions.ts";
import { removeNoteAction as a28 } from "@/app/admin/(dashboard)/utilitarios/qualificacao/actions.ts";
import {
  removeSupplier as a29,
  removeOrder as a30,
} from "@/app/admin/(dashboard)/utilitarios/solicitacao-papeis/actions.ts";
import {
  removeTransferAction as a19,
  removeFilingAction as a20,
} from "@/app/admin/(dashboard)/utilitarios/titularidade/actions.ts";
import {
  setPersonDeletedAction as a0,
  setFileDeletedAction as a1,
  setAnnotationDeletedAction as a2,
  setGeometryDeletedAction as a3,
  withdrawExportAction as a4,
  forgetLearnedActAction as a5,
} from "@/app/admin/ri/actions.ts";

/**
 * Every deletion that waits for the Tabelião (lib/approval.ts), by its key:
 * what it is, and the action replayed with the form as it was sent when
 * the request is approved (decision of 27/11/2026).
 */
// biome-ignore lint/suspicious/noExplicitAny: each action keeps its own state type.
type Replayable = (previous: any, formData: FormData) => Promise<unknown>;

export const APPROVABLE: Record<string, { label: string; run: Replayable }> = {
  "ri.person": { label: "Pessoa do Indicador Pessoal (RI)", run: a0 },
  "ri.file": { label: "Anexo da matrícula (RI)", run: a1 },
  "ri.annotation": { label: "Anotação da matrícula (RI)", run: a2 },
  "ri.geometry": { label: "Georreferenciamento do imóvel (RI)", run: a3 },
  "ri.export": { label: "Carga gerada para a ONR (RI)", run: a4 },
  "ri.learned": { label: "Modelo aprendido de ato (RI)", run: a5 },
  "attributions.file": { label: "Arquivo de atribuição", run: a6 },
  "agenda.appointment": { label: "Agendamento", run: a7 },
  "users.deactivate": { label: "Desativar conta de usuário", run: a8 },
  "users.delete": { label: "Excluir conta de usuário", run: a9 },
  "requests.bulk": { label: "Pedidos desativados em lote", run: a10 },
  "request.attachment": { label: "Anexo do pedido", run: a11 },
  "request.delete": { label: "Pedido", run: a12 },
  "request.requirement": { label: "Exigência do pedido", run: a13 },
  certificate: { label: "Certificado digital", run: a14 },
  sector: { label: "Setor", run: a15 },
  "numbering.issued": { label: "Número emitido", run: a16 },
  "team.person": { label: "Pessoa da equipe do site", run: a17 },
  pix: { label: "Chave Pix do cartório", run: a18 },
  "titularidade.transfer": { label: "Comunicação de titularidade", run: a19 },
  "titularidade.filing": {
    label: "Ofício de titularidade à prefeitura",
    run: a20,
  },
  "paper.lot": { label: "Lote de papel de segurança", run: a21 },
  "paper.movement": { label: "Lançamento de papel de segurança", run: a22 },
  "paper.report": { label: "Ofício de papel de segurança", run: a23 },
  guide: { label: "Guia imobiliária", run: a24 },
  "guide.status": { label: "Situação da guia", run: a25 },
  "signer.document": { label: "Documento assinado", run: a26 },
  iss: { label: "Declaração de ISS", run: a27 },
  "qualificacao.note": { label: "Nota de qualificação", run: a28 },
  "paper-orders.supplier": { label: "Fornecedor de papel", run: a29 },
  "paper-orders.order": { label: "Solicitação de papel", run: a30 },
  "censec.act": { label: "Ato da carga CENSEC", run: a31 },
  "censec.closing": { label: "Fechamento da carga CENSEC", run: a32 },
  "knowledge.remove": { label: "Documento da base jurídica", run: a33 },
  "knowledge.request": {
    label: "Pedido de inclusão na base jurídica",
    run: a34,
  },
  "daily-book.entry": { label: "Lançamento do Livro Diário", run: a35 },
  "daily-book.report": { label: "Relatório do Livro Diário", run: a36 },
  "daily-book.excess": { label: "Cálculo do excedente", run: a37 },
  "daily-book.fcrcpn": { label: "Repasse FCRCPN", run: a38 },
  "transparency.document": { label: "Documento da Transparência", run: a39 },
  "transparency.bulletin": { label: "Boletim da Transparência", run: a40 },
  "compliance.attachment": { label: "Anexo da Adequação", run: a41 },
  "compliance.done": { label: '"Já cumpri" da Adequação', run: a42 },
  "lgpd.attachment": { label: "Anexo do requerimento LGPD", run: a43 },
  "publication.delete": { label: "Publicação", run: a44 },
  "publication.archive": { label: "Publicação arquivada", run: a45 },
  "rcpn.import.hide": { label: "Importação do Registro Civil", run: a46 },
  "rcpn.import.file": {
    label: "Arquivo importado do Registro Civil",
    run: a47,
  },
  "rcpn.certidao": { label: "Certidão do Registro Civil", run: a48 },
  "rcpn.habilitacao": { label: "Habilitação de casamento", run: a49 },
};
