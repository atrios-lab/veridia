import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_MESSAGE_LENGTH } from "../chat/message.ts";
import {
  isAllowedOmbudsmanTransition,
  isAllowedTransition,
  isOmbudsmanStatus,
  isOpenServiceRequestStatus,
  isOpenStatus,
  isPaymentSettled,
  isServiceRequestStatus,
  OMBUDSMAN_STATUSES,
  ombudsmanDetailsSchema,
  PROGRESS_STEPS,
  parseDetails,
  phaseOfStatus,
  progressOf,
  readChannel,
  readExemption,
  requiresStatusReason,
  SERVICE_REQUEST_PHASES,
  SERVICE_REQUEST_STATUSES,
  STATUS_GUIDANCE,
  statusAfterAmount,
  statusForRequirements,
  statusLabel,
  statusReasonSchema,
  stepStates,
  suggestedNextStatuses,
  suggestedOmbudsmanStatuses,
  transitionLabel,
  validateStatusReason,
} from "./kinds.ts";

test("every service request status has a Portuguese label", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.notEqual(statusLabel("service-request", status), "Em andamento");
  }
});

test("a value outside the eleven is not a service request status", () => {
  assert.equal(isServiceRequestStatus("in-progress"), false);
  assert.equal(isServiceRequestStatus("new"), true);
  assert.equal(isServiceRequestStatus("processing"), true);
  assert.equal(isServiceRequestStatus("awaiting-compliance"), true);
});

test("the andamentos folded away by enxugar-status-pedido no longer validate", () => {
  // Trimmed from twenty to eleven: filed had no rule of its own; the
  // registral steps and with-requirement/inactive folded into a status that
  // already existed. A row still holding one of these needs the data
  // migration, not a fallback here. "in-review" came back (decision of
  // 12/11/2026) with a rule of its own: the qualificação, before anything
  // is asked or charged.
  assert.equal(isServiceRequestStatus("in-review"), true);
  for (const status of [
    "filed",
    "pre-noted",
    "in-qualification",
    "registered",
    "annotated",
    "granted",
    "with-requirement",
    "inactive",
  ]) {
    assert.equal(isServiceRequestStatus(status), false, status);
  }
});

test("every andamento belongs to exactly one phase", () => {
  const seen = new Set<string>();
  for (const phase of SERVICE_REQUEST_PHASES) {
    for (const status of phase.statuses) {
      assert.equal(seen.has(status), false, `${status} in two phases`);
      seen.add(status);
    }
  }
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.ok(seen.has(status), `${status} has no phase`);
    assert.ok(phaseOfStatus(status));
  }
  assert.equal(seen.size, SERVICE_REQUEST_STATUSES.length);
});

test("the flow is free, except standing still", () => {
  // A title's andamento does not fit a state machine: uma exigência pode
  // voltar depois de resolvida, um concluído pode reabrir. The only refusal
  // is a no-op.
  assert.ok(isAllowedTransition("done", "processing"));
  assert.ok(isAllowedTransition("cancelled", "awaiting-compliance"));
  assert.ok(isAllowedTransition("archived", "new"));
  assert.equal(isAllowedTransition("processing", "processing"), false);
});

test("open counts everything short of a terminal andamento", () => {
  assert.ok(isOpenServiceRequestStatus("new"));
  assert.ok(isOpenServiceRequestStatus("processing"));
  assert.ok(isOpenServiceRequestStatus("awaiting-payment"));
  assert.ok(isOpenServiceRequestStatus("ready-for-pickup"));
  assert.equal(isOpenServiceRequestStatus("done"), false);
  assert.equal(isOpenServiceRequestStatus("rejected"), false);
  assert.equal(isOpenServiceRequestStatus("cancelled"), false);
  assert.equal(isOpenServiceRequestStatus("archived"), false);
});

test("suggested transitions match what the detail screen offers", () => {
  // "Aguardando pagamento" comes from informing the value, not a button.
  assert.deepEqual(suggestedNextStatuses("new"), ["in-review", "cancelled"]);
  assert.deepEqual(suggestedNextStatuses("in-review"), [
    "processing",
    "awaiting-guide-payment",
    "rejected",
    "cancelled",
  ]);
  // A cumprida exigência is examined again before the act goes on.
  assert.deepEqual(suggestedNextStatuses("awaiting-compliance"), [
    "in-review",
    "rejected",
    "cancelled",
  ]);
  assert.deepEqual(suggestedNextStatuses("ready-for-pickup"), ["done"]);
  assert.deepEqual(suggestedNextStatuses("archived"), []);
});

test("informing the value moves the request to Aguardando pagamento", () => {
  assert.equal(statusAfterAmount("new", null, 4210), "awaiting-payment");
  assert.equal(statusAfterAmount("in-review", null, 4210), "awaiting-payment");
  // Taken to processing before any value: the value still asks for payment.
  assert.equal(statusAfterAmount("processing", null, 4210), "awaiting-payment");
  // A correction of a value already informed does not move it back.
  assert.equal(statusAfterAmount("processing", 4000, 4210), null);
  assert.equal(statusAfterAmount("awaiting-payment", 4000, 4210), null);
  assert.equal(statusAfterAmount("payment-reported", 4000, 4210), null);
  assert.equal(statusAfterAmount("awaiting-compliance", null, 4210), null);
  assert.equal(statusAfterAmount("done", null, 4210), null);
  assert.equal(statusAfterAmount("new", null, 0), null);
  // Cleared, a request waiting on it goes back to the analysis.
  assert.equal(statusAfterAmount("awaiting-payment", 4210, null), "in-review");
  assert.equal(statusAfterAmount("processing", 4210, null), null);
});

test("the buttons say the act, not only the andamento", () => {
  assert.equal(
    transitionLabel("payment-reported", "processing"),
    "Confirmar o pagamento",
  );
  assert.equal(
    transitionLabel("payment-reported", "awaiting-payment"),
    "Recusar o comprovante",
  );
  assert.equal(transitionLabel("new", "in-review"), "Iniciar a análise");
  assert.equal(
    transitionLabel("awaiting-compliance", "in-review"),
    "Exigência cumprida: retomar a análise",
  );
  assert.equal(
    transitionLabel("in-review", "processing"),
    "Concluir a análise e executar o ato",
  );
  assert.equal(
    transitionLabel("ready-for-pickup", "done"),
    "Registrar a entrega e concluir",
  );
  assert.equal(transitionLabel("in-review", "rejected"), "Indeferir o pedido");
  assert.equal(transitionLabel("new", "cancelled"), "Cancelar o pedido");
});

test("the andamento in percent, rising along the way", () => {
  const path = [
    "new",
    "in-review",
    "awaiting-compliance",
    "awaiting-payment",
    "payment-reported",
    "awaiting-guide-payment",
    "processing",
    "ready-for-pickup",
    "done",
  ] as const;
  const values = path.map((s) => progressOf(s) ?? -1);
  assert.deepEqual(
    values,
    [...values].sort((a, b) => a - b),
  );
  assert.equal(progressOf("new"), 10);
  assert.equal(progressOf("done"), 100);
  assert.equal(progressOf("cancelled"), null);
  assert.equal(progressOf("rejected"), null);
  assert.equal(progressOf("nonsense"), null);
});

test("payment-reported: the one andamento the citizen writes", () => {
  assert.ok(isServiceRequestStatus("payment-reported"));
  assert.equal(phaseOfStatus("payment-reported"), "payment");
  assert.equal(
    statusLabel("service-request", "payment-reported"),
    "Comprovante em conferência",
  );
  assert.deepEqual(suggestedNextStatuses("payment-reported"), [
    "processing",
    "awaiting-payment",
    "cancelled",
  ]);
  assert.ok(isOpenServiceRequestStatus("payment-reported"));
});

test("payment is settled once a request leaves the two andamentos that wait on money", () => {
  assert.equal(isPaymentSettled("new"), false);
  assert.equal(isPaymentSettled("in-review"), false);
  assert.equal(isPaymentSettled("awaiting-payment"), false);
  assert.equal(isPaymentSettled("payment-reported"), false);
  // Reached from any prior andamento, including one where payment was
  // already confirmed: an exigência raised afterward does not unsettle it.
  assert.equal(isPaymentSettled("awaiting-compliance"), true);
  assert.equal(isPaymentSettled("processing"), true);
  assert.equal(isPaymentSettled("ready-for-pickup"), true);
  assert.equal(isPaymentSettled("done"), true);
  assert.equal(isPaymentSettled("rejected"), true);
  assert.equal(isPaymentSettled("cancelled"), true);
  assert.equal(isPaymentSettled("archived"), true);
});

test("every suggestion is itself a valid andamento", () => {
  // A typo here would offer the operator a button the server then refuses.
  for (const status of SERVICE_REQUEST_STATUSES) {
    for (const next of suggestedNextStatuses(status)) {
      assert.ok(isServiceRequestStatus(next), `${status} -> ${next}`);
      assert.notEqual(next, status, `${status} suggests itself`);
    }
  }
});

test("isOpenStatus counts everything short of each kind's terminal statuses", () => {
  assert.ok(isOpenStatus("appointment", "requested"));
  assert.ok(isOpenStatus("appointment", "proposed"));
  assert.ok(isOpenStatus("appointment", "confirmed"));
  assert.equal(isOpenStatus("appointment", "done"), false);
  assert.equal(isOpenStatus("appointment", "cancelled"), false);

  assert.ok(isOpenStatus("data-rights", "new"));
  assert.equal(isOpenStatus("data-rights", "answered"), false);
  assert.equal(isOpenStatus("data-rights", "cancelled"), false);

  assert.ok(isOpenStatus("ombudsman", "new"));
  assert.ok(isOpenStatus("ombudsman", "in-review"));
  assert.equal(isOpenStatus("ombudsman", "answered"), false);
  assert.equal(isOpenStatus("ombudsman", "done"), false);
});

test("isOpenStatus agrees with isOpenServiceRequestStatus for service requests", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.equal(
      isOpenStatus("service-request", status),
      isOpenServiceRequestStatus(status),
    );
  }
});

test("draft reply and internal note round-trip through details", () => {
  const details = parseDetails("ombudsman", {
    manifestationType: "complaint",
    anonymous: true,
    confidential: false,
    draftReply: "rascunho",
    internalNote: "nota interna",
  });
  assert.equal(details.draftReply, "rascunho");
  assert.equal(details.internalNote, "nota interna");

  const bare = ombudsmanDetailsSchema.parse({
    manifestationType: "praise",
    anonymous: false,
    confidential: false,
  });
  assert.equal(bare.draftReply, undefined);
  assert.equal(bare.internalNote, undefined);
});

test("a service request's details carry the consent with its timestamp", () => {
  const consentedAt = "2026-08-11T12:00:00.000Z";
  const details = parseDetails("service-request", {
    channel: "online",
    consents: { lgpd: consentedAt, truth: consentedAt },
  });
  assert.equal(details.consents?.lgpd, consentedAt);
  assert.equal(details.consents?.truth, consentedAt);
});

test("requests filed before the consent was recorded still parse", () => {
  // Absence reads as "predates the record", never as an invalid row.
  const details = parseDetails("service-request", { channel: "counter" });
  assert.equal(details.consents, undefined);
});

test("a consent that is not a timestamp is refused", () => {
  assert.throws(() =>
    parseDetails("service-request", {
      consents: { lgpd: "sim", truth: "sim" },
    }),
  );
});

test("a pedido de gratuidade anterior à declaração continua legível", () => {
  // Formato v1: só declaredAt e actId. beneficiaries volta [] para dizer
  // "nada foi coletado", nunca um beneficiário inventado no lugar.
  const exemption = readExemption({
    exemption: {
      declaredAt: "2026-08-04T12:00:00.000Z",
      actId: "rcpn-certidao",
    },
  });
  assert.equal(exemption?.declaredAt, "2026-08-04T12:00:00.000Z");
  assert.equal(exemption?.actId, "rcpn-certidao");
  assert.deepEqual(exemption?.beneficiaries, []);
  assert.equal(exemption?.decision, undefined);
});

test("uma declaração completa do Anexo I é lida de volta", () => {
  const declaredAt = "2026-09-10T12:00:00.000Z";
  const exemption = readExemption({
    exemption: {
      declaredAt,
      actId: "rcpn-certidao",
      certificateType: "com-busca",
      beneficiaries: [
        {
          name: "Maria José da Silva",
          signedBy: "on-behalf",
          signer: { name: "João da Silva", cpfOrId: "52998224725" },
          witnesses: [{ name: "T1" }, { name: "T2" }],
        },
      ],
    },
  });
  assert.equal(exemption?.certificateType, "com-busca");
  assert.equal(exemption?.beneficiaries.length, 1);
  assert.equal(exemption?.beneficiaries[0].signedBy, "on-behalf");
  assert.equal(exemption?.beneficiaries[0].signer?.name, "João da Silva");
  assert.equal(exemption?.beneficiaries[0].witnesses?.[1].name, "T2");
});

test("beneficiário sem signedBy assume a própria pessoa", () => {
  const exemption = readExemption({
    exemption: {
      declaredAt: "2026-09-10T12:00:00.000Z",
      beneficiaries: [{ name: "Maria" }],
    },
  });
  assert.equal(exemption?.beneficiaries[0].signedBy, "self");
});

test("um pedido sem gratuidade não tem exemption nenhuma", () => {
  assert.equal(readExemption({}), undefined);
  assert.equal(readExemption(null), undefined);
});

test("o desfecho da gratuidade vem junto quando registrado", () => {
  const exemption = readExemption({
    exemption: {
      declaredAt: "2026-09-10T12:00:00.000Z",
      decision: {
        outcome: "granted",
        decidedAt: "2026-09-12T09:00:00.000Z",
        decidedBy: "op-1",
      },
    },
  });
  assert.equal(exemption?.decision?.outcome, "granted");
  assert.equal(exemption?.decision?.decidedBy, "op-1");
});

test("o aceite pelo site grava o IP junto da declaração", () => {
  const exemption = readExemption({
    exemption: {
      declaredAt: "2026-09-11T09:41:00.000Z",
      actId: "rcpn-certidao",
      beneficiaries: [{ name: "Maria José da Silva" }],
      acceptance: { ip: "203.0.113.7" },
    },
  });
  assert.equal(exemption?.acceptance?.ip, "203.0.113.7");
});

test("pedido sem acceptance (balcão, ou anterior ao IP) lê undefined", () => {
  const exemption = readExemption({
    exemption: {
      declaredAt: "2026-09-11T09:41:00.000Z",
      beneficiaries: [{ name: "Maria" }],
    },
  });
  assert.equal(exemption?.acceptance, undefined);
});

test("readChannel lê o canal bruto, inclusive valores fora do enum", () => {
  assert.equal(readChannel({ channel: "counter" }), "counter");
  // "chat" não está em SERVICE_REQUEST_CHANNELS, mas o balcão grava esse
  // valor (pedidos/novo/actions.ts) e o carimbo precisa conseguir lê-lo.
  assert.equal(readChannel({ channel: "chat" }), "chat");
  assert.equal(readChannel({}), undefined);
  assert.equal(readChannel(null), undefined);
});

test("every manifestation andamento has a Portuguese label", () => {
  for (const status of OMBUDSMAN_STATUSES) {
    assert.notEqual(statusLabel("ombudsman", status), "Em andamento");
  }
});

test("an andamento of another channel is not a manifestation andamento", () => {
  // `status` is one column shared by the four kinds, so a value from the
  // request's eighteen reaches the ombudsman action without a type error.
  assert.equal(isOmbudsmanStatus("pre-noted"), false);
  assert.equal(isOmbudsmanStatus("cancelled"), false);
  assert.equal(isOmbudsmanStatus("archived"), true);
});

test("the office is never offered the andamento it is already in", () => {
  for (const status of OMBUDSMAN_STATUSES) {
    assert.equal(
      suggestedOmbudsmanStatuses(status).includes(status),
      false,
      status,
    );
  }
});

test("every suggested andamento belongs to the channel", () => {
  for (const status of OMBUDSMAN_STATUSES) {
    for (const next of suggestedOmbudsmanStatuses(status)) {
      assert.ok(isOmbudsmanStatus(next), next);
    }
  }
});

test("answering is never a andamento to pick", () => {
  // Setting it without sending the reply would leave the consult showing
  // "Respondida" with nothing to read.
  for (const status of OMBUDSMAN_STATUSES) {
    assert.equal(
      suggestedOmbudsmanStatuses(status).includes("answered"),
      false,
      status,
    );
    assert.equal(isAllowedOmbudsmanTransition(status, "answered"), false);
  }
});

test("a manifestation may be moved back out of a terminal andamento", () => {
  // Correcting a human error is a use case, not an exception.
  assert.ok(isAllowedOmbudsmanTransition("archived", "in-review"));
  assert.ok(isAllowedOmbudsmanTransition("done", "in-review"));
});

test("moving to the current andamento writes an event carrying nothing", () => {
  for (const status of OMBUDSMAN_STATUSES) {
    assert.equal(isAllowedOmbudsmanTransition(status, status), false);
  }
});

test("an archived manifestation no longer asks for attention", () => {
  assert.equal(isOpenStatus("ombudsman", "archived"), false);
  assert.equal(isOpenStatus("ombudsman", "done"), false);
  assert.equal(isOpenStatus("ombudsman", "answered"), false);
  assert.equal(isOpenStatus("ombudsman", "new"), true);
  assert.equal(isOpenStatus("ombudsman", "in-review"), true);
});

test("registering a requirement moves the request to Aguardando exigência", () => {
  assert.equal(statusForRequirements("processing", 1), "awaiting-compliance");
  assert.equal(statusForRequirements("new", 1), "awaiting-compliance");
  // Already there: a second requirement while one is still open doesn't
  // rewrite it.
  assert.equal(statusForRequirements("awaiting-compliance", 2), null);
});

test("closing the last requirement sends the request back to the analysis", () => {
  assert.equal(statusForRequirements("awaiting-compliance", 0), "in-review");
  // One still open: it stays where it is.
  assert.equal(statusForRequirements("awaiting-compliance", 1), null);
});

test("only Aguardando exigência comes back from a closed requirement", () => {
  // The office moved on while an exigência sat open; closing it must not drag
  // the request back into a status it already left.
  assert.equal(statusForRequirements("processing", 0), null);
  assert.equal(statusForRequirements("new", 0), null);
});

test("a requirement moves nothing on a closed request", () => {
  // Noting or clearing an exigência does not reopen it by itself.
  for (const status of ["done", "cancelled", "archived"] as const) {
    assert.equal(statusForRequirements(status, 1), null);
    assert.equal(statusForRequirements(status, 0), null);
  }
});

test("only cancelled and rejected require a status reason", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.equal(
      requiresStatusReason(status),
      status === "cancelled" || status === "rejected",
      status,
    );
  }
});

test("status reason is trimmed", () => {
  const parsed = statusReasonSchema.parse("  Documentação incompatível  ");
  assert.equal(parsed, "Documentação incompatível");
});

test("empty status reason is refused", () => {
  assert.equal(statusReasonSchema.safeParse("").success, false);
  assert.equal(statusReasonSchema.safeParse("   ").success, false);
});

test("status reason has the same length ceiling as free-text messages", () => {
  assert.ok(
    statusReasonSchema.safeParse("a".repeat(MAX_MESSAGE_LENGTH)).success,
  );
  assert.equal(
    statusReasonSchema.safeParse("a".repeat(MAX_MESSAGE_LENGTH + 1)).success,
    false,
  );
});

test("rejected accepts a PDF with no text", () => {
  const result = validateStatusReason({
    status: "rejected",
    reason: "",
    hasAttachment: true,
  });
  assert.deepEqual(result, { ok: true, reason: null });
});

test("rejected accepts text with no PDF", () => {
  const result = validateStatusReason({
    status: "rejected",
    reason: "Certidão anexada ilegível",
    hasAttachment: false,
  });
  assert.deepEqual(result, { ok: true, reason: "Certidão anexada ilegível" });
});

test("rejected accepts text and a PDF together", () => {
  const result = validateStatusReason({
    status: "rejected",
    reason: "Certidão anexada ilegível",
    hasAttachment: true,
  });
  assert.deepEqual(result, { ok: true, reason: "Certidão anexada ilegível" });
});

test("rejected refuses neither text nor PDF", () => {
  const result = validateStatusReason({
    status: "rejected",
    reason: "   ",
    hasAttachment: false,
  });
  assert.equal(result.ok, false);
});

test("rejected with too-long text is refused even with a PDF attached", () => {
  const result = validateStatusReason({
    status: "rejected",
    reason: "a".repeat(MAX_MESSAGE_LENGTH + 1),
    hasAttachment: true,
  });
  assert.equal(result.ok, false);
});

test("cancelled still requires text on its own, PDF or not", () => {
  const withoutAttachment = validateStatusReason({
    status: "cancelled",
    reason: "",
    hasAttachment: false,
  });
  assert.equal(withoutAttachment.ok, false);

  // No screen offers a PDF for "cancelled" (see status-section.tsx), but the
  // server is the one that actually enforces it, so it is checked here too.
  const withAttachment = validateStatusReason({
    status: "cancelled",
    reason: "",
    hasAttachment: true,
  });
  assert.equal(withAttachment.ok, false);
});

test("statuses that need no reason accept anything", () => {
  const result = validateStatusReason({
    status: "processing",
    reason: "",
    hasAttachment: false,
  });
  assert.deepEqual(result, { ok: true, reason: null });
});

test("aguardando pagamento da guia: o imposto vai ao fisco, não à serventia", () => {
  assert.ok(isServiceRequestStatus("awaiting-guide-payment"));
  assert.equal(phaseOfStatus("awaiting-guide-payment"), "payment");
  assert.equal(
    statusLabel("service-request", "awaiting-guide-payment"),
    "Aguardando recolhimento do imposto",
  );
  // The office's Pix charge is not what is pending here.
  assert.equal(isPaymentSettled("awaiting-guide-payment"), true);
  assert.ok(isOpenServiceRequestStatus("awaiting-guide-payment"));
  assert.ok(
    suggestedNextStatuses("processing").includes("awaiting-guide-payment"),
  );
});

test("the steps: done behind, the current one named, the rest ahead", () => {
  assert.deepEqual(stepStates(PROGRESS_STEPS, 10), [
    "current",
    "todo",
    "todo",
    "todo",
    "todo",
  ]);
  // Comprovante em conferência (50%) is still the payment step.
  assert.deepEqual(
    stepStates(PROGRESS_STEPS, progressOf("payment-reported") ?? 0),
    ["done", "done", "current", "todo", "todo"],
  );
  // An exigência (25%) holds the request in the analysis.
  assert.equal(
    stepStates(PROGRESS_STEPS, progressOf("awaiting-compliance") ?? 0)[1],
    "current",
  );
  assert.deepEqual(stepStates(PROGRESS_STEPS, 100), [
    "done",
    "done",
    "done",
    "done",
    "done",
  ]);
});

test("every andamento says who holds it and what comes next", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    const g = STATUS_GUIDANCE[status];
    assert.ok(g.meaning.length > 10, status);
    assert.ok(g.next.length > 10, status);
    assert.equal(
      g.holder === null,
      !isOpenServiceRequestStatus(status),
      status,
    );
  }
  assert.equal(STATUS_GUIDANCE["payment-reported"].holder, "office");
  assert.equal(STATUS_GUIDANCE["awaiting-payment"].holder, "applicant");
});

test("pedido do site espera o requerimento assinado antes de chegar ao cartório", () => {
  assert.ok(isServiceRequestStatus("awaiting-signed-form"));
  assert.equal(
    statusLabel("service-request", "awaiting-signed-form"),
    "Aguardando requerimento assinado",
  );
  assert.deepEqual(suggestedNextStatuses("awaiting-signed-form"), [
    "new",
    "cancelled",
  ]);
  assert.equal(
    transitionLabel("awaiting-signed-form", "new"),
    "Requerimento conferido: liberar o pedido",
  );
  assert.equal(isPaymentSettled("awaiting-signed-form"), false);
  assert.equal(STATUS_GUIDANCE["awaiting-signed-form"].holder, "applicant");
});
