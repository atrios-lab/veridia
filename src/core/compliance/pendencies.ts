import { classificationOf } from "./classification.ts";
import {
  type Answers,
  findSection,
  isVisible,
  list,
  multi,
  SECTIONS,
  text,
  UNENCRYPTED_CLOUDS,
  UNKNOWN,
} from "./sections.ts";

export type Severity = "critical" | "warning" | "info";

/**
 * Something the answers reveal that the documents will have to carry: a
 * pendência with a 30-day term, a change in the risk analysis, a declaration
 * that replaces a missing report. The module only detects and tells; the
 * generator, outside the panel, is what writes it into the documents.
 */
export interface Pendency {
  code: string;
  severity: Severity;
  sectionId: string;
  /** The field that triggered it, so the screen can warn right under it. */
  field?: string;
  title: string;
  detail: string;
}

export function detectPendencies(answers: Answers): Pendency[] {
  const found: Pendency[] = [];
  const add = (
    code: string,
    severity: Severity,
    sectionId: string,
    field: string,
    title: string,
    detail: string,
  ) => found.push({ code, severity, sectionId, field, title, detail });

  const windows = text(answers, "softwares", "windows");
  if (windows === "windows-10") {
    add(
      "windows-10",
      "critical",
      "softwares",
      "windows",
      "O Windows 10 está sem suporte desde 14/10/2025.",
      "Entra nos documentos como pendência com prazo de 30 dias. Você não precisa resolver agora: a Átrios orienta a troca quando entregar os documentos.",
    );
  } else if (windows === "older") {
    add(
      "windows-old",
      "critical",
      "softwares",
      "windows",
      "Windows anterior ao 10 não recebe mais correções de segurança.",
      "Entra nos documentos como pendência com prazo de 30 dias.",
    );
  }

  if (text(answers, "softwares", "office") === "office-2013") {
    add(
      "office-2013",
      "critical",
      "softwares",
      "office",
      "Office 2013 ou anterior está sem suporte.",
      "Entra nos documentos como pendência com prazo de 30 dias.",
    );
  }

  if (text(answers, "softwares", "antivirus") === "none") {
    add(
      "no-antivirus",
      "critical",
      "softwares",
      "antivirus",
      "Sem antivírus é pendência crítica.",
      "O plano registra a instalação nos primeiros 30 dias. O Windows Defender, que já vem no Windows, resolve o mínimo.",
    );
  }

  if (text(answers, "backup", "hasBackup") === "no") {
    add(
      "no-backup",
      "critical",
      "backup",
      "hasBackup",
      "Sem cópia de segurança é pendência crítica.",
      "O plano de continuidade registra a rotina de backup nos primeiros 30 dias.",
    );
  }
  const clouds = multi(answers, "backup", "locations").filter((l) =>
    UNENCRYPTED_CLOUDS.includes(l),
  );
  if (clouds.length > 0) {
    add(
      "cloud-unencrypted",
      "warning",
      "backup",
      "locations",
      "Google Drive, OneDrive e Dropbox não cifram a cópia na origem.",
      "O plano prevê a criptografia na origem (Duplicati) nos primeiros 30 dias. A cópia continua onde está.",
    );
  }
  if (text(answers, "backup", "restoreTested") === "never") {
    add(
      "restore-untested",
      "warning",
      "backup",
      "restoreTested",
      "Backup nunca restaurado.",
      "O plano prevê um teste de restauração documentado nos primeiros 30 dias.",
    );
  }
  if (text(answers, "backup", "cloudAccount") === "personal") {
    add(
      "personal-cloud",
      "warning",
      "backup",
      "cloudAccount",
      "A cópia está numa conta pessoal.",
      "O plano prevê mover a cópia para uma conta da serventia.",
    );
  }

  if (text(answers, "energia", "hasUps") === "no") {
    add(
      "no-ups",
      "critical",
      "energia",
      "hasUps",
      "Sem nobreak é pendência.",
      "A norma pede 30 minutos de autonomia. Entra no plano com prazo de 30 dias.",
    );
  } else if (
    ["under-15", "15-30"].includes(text(answers, "energia", "upsMinutes"))
  ) {
    add(
      "ups-short",
      "warning",
      "energia",
      "upsMinutes",
      "Abaixo dos 30 minutos que a norma pede.",
      "Entra como pendência de 30 dias. A Átrios sugere o modelo certo.",
    );
  }
  const grounding = text(answers, "energia", "grounding");
  if (grounding === "no") {
    add(
      "no-grounding",
      "warning",
      "energia",
      "grounding",
      "Sem aterramento.",
      "O plano de energia registra a pendência de aterramento com laudo.",
    );
  } else if (
    grounding === "without-report" &&
    text(answers, "energia", "threePhase") === "yes"
  ) {
    add(
      "grounding-declaration",
      "info",
      "energia",
      "threePhase",
      "Prédio comercial trifásico: vale a declaração de cumprimento.",
      "O plano de energia registra a declaração no lugar da pendência de laudo.",
    );
  } else if (grounding === "without-report") {
    add(
      "grounding-no-report",
      "warning",
      "energia",
      "grounding",
      "Aterramento sem laudo.",
      "O plano de energia registra a pendência de laudo, salvo em prédio comercial trifásico.",
    );
  }

  const mfa = text(answers, "acessos", "mfa");
  if (mfa === "none") {
    add(
      "no-mfa",
      "critical",
      "acessos",
      "mfa",
      "Nenhum sistema pede o segundo código.",
      "É a autenticação em duas etapas (item 1.3). Entra no plano com prazo de 30 dias.",
    );
  } else if (mfa === "some") {
    add(
      "partial-mfa",
      "warning",
      "acessos",
      "mfa",
      "Só parte dos sistemas pede o segundo código.",
      "O plano registra a ativação nos que faltam, com prazo de 30 dias.",
    );
  }
  if (
    ["some-shared", "all-shared"].includes(text(answers, "acessos", "logins"))
  ) {
    add(
      "shared-logins",
      "warning",
      "acessos",
      "logins",
      "Logins compartilhados.",
      "A norma pede um login por pessoa. O plano registra a separação com prazo de 30 dias.",
    );
  }

  if (text(answers, "equipe", "personalDevices") === "yes") {
    add(
      "personal-devices",
      "warning",
      "equipe",
      "personalDevices",
      "Equipamento pessoal em uso no trabalho.",
      "A política registra a vedação e a providência. Não impede nada agora.",
    );
  }

  if (text(answers, "sistemas", "hosting") === "vendor-cloud") {
    add(
      "vendor-cloud",
      "info",
      "sistemas",
      "hosting",
      "Sistemas na nuvem do fornecedor.",
      "A análise de risco muda: o servidor local vira cópia e o risco principal passa a ser internet e fornecedor.",
    );
  }

  const classification = classificationOf(answers);
  if (
    classification?.classe === 1 &&
    text(answers, "encarregado", "willAppoint") === "no"
  ) {
    add(
      "dpo-waived",
      "info",
      "encarregado",
      "willAppoint",
      "Sem encarregado nomeado (Classe 1).",
      "A portaria 003 não é gerada; a capa e a declaração registram a dispensa pelo Provimento 214.",
    );
  }

  return found;
}

export interface UnknownAnswer {
  sectionId: string;
  sectionTitle: string;
  field: string;
  label: string;
}

/** Every "não sei" the office gave: what the Átrios confirms by WhatsApp. */
export function unknownAnswers(answers: Answers): UnknownAnswer[] {
  const found: UnknownAnswer[] = [];
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (!isVisible(field, { answers })) continue;
      const value = answers[section.id]?.[field.name];
      const unknown =
        value === UNKNOWN ||
        (Array.isArray(value) && (value as string[]).includes(UNKNOWN));
      if (unknown) {
        found.push({
          sectionId: section.id,
          sectionTitle: section.title,
          field: field.name,
          label: field.label,
        });
      }
    }
  }
  return found;
}

/** Pendencies of one section, keyed by the field that raised them. */
export function pendenciesByField(
  sectionId: string,
  pendencies: Pendency[],
): Record<string, Pendency[]> {
  const byField: Record<string, Pendency[]> = {};
  for (const p of pendencies) {
    if (p.sectionId !== sectionId || !p.field) continue;
    byField[p.field] ??= [];
    byField[p.field].push(p);
  }
  return byField;
}

/** How many pendencies each section raised, for the list's badges. */
export function pendencyCounts(pendencies: Pendency[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of pendencies) {
    if (p.severity === "info") continue;
    counts[p.sectionId] = (counts[p.sectionId] ?? 0) + 1;
  }
  return counts;
}

export function sectionTitle(sectionId: string): string {
  return findSection(sectionId)?.title ?? sectionId;
}

/** People from Seção 3, for the "ciência" list and the generator. */
export function teamNames(answers: Answers): string[] {
  return list(answers, "equipe", "team")
    .map((p) => String(p.name ?? "").trim())
    .filter(Boolean);
}
