import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkLevels,
  checkTeamFile,
  DEFAULT_TEAM_LEVELS,
  groupByLevel,
  guessLevel,
  levelsFrom,
  publicPerson,
  StaffInputSchema,
  type StaffRecord,
  signersFrom,
  slugFor,
  sniffTeamFile,
  uniqueLevelId,
} from "./team.ts";

// Fictitious people only.
const person = (over: Partial<StaffRecord> = {}): StaffRecord => ({
  id: "p1",
  name: "Elisa Exemplo Prado",
  levelId: "escrevente-autorizado",
  profession: "Bacharela em Direito",
  registration: "Portaria 006/2024",
  portariaDate: "2024-05-20",
  position: 1,
  showOnSite: true,
  imageConsent: true,
  canSign: false,
  signerOrder: null,
  hasPhoto: true,
  hasPortaria: true,
  hasWord: true,
  archived: false,
  ...over,
});

test("os níveis começam na ordem do Tabelião, sem escrevente substituto", () => {
  assert.deepEqual(
    DEFAULT_TEAM_LEVELS.map((l) => l.label),
    [
      "Tabelião e Registrador",
      "Substituto legal",
      "Substituto",
      "Escrevente autorizado",
      "Escrevente",
      "Auxiliar de cartório",
      "Serviços gerais",
    ],
  );
  assert.deepEqual(levelsFrom(null), [...DEFAULT_TEAM_LEVELS]);
  assert.deepEqual(levelsFrom([]), [...DEFAULT_TEAM_LEVELS]);
  assert.deepEqual(
    levelsFrom([
      { id: "a", label: "Um" },
      { id: "a", label: "Repetido" },
      { id: "Inválido!", label: "X" },
      { id: "b", label: "Dois" },
    ]),
    [
      { id: "a", label: "Um" },
      { id: "b", label: "Dois" },
    ],
  );
});

test("o id de um nível novo sai do nome e nunca repete", () => {
  assert.equal(slugFor("Escrevente júnior"), "escrevente-junior");
  assert.equal(slugFor("!!!"), "nivel");
  const levels = [{ id: "estagiario", label: "Estagiário" }];
  assert.equal(uniqueLevelId(levels, "Estagiário"), "estagiario-2");
  assert.equal(uniqueLevelId(levels, "Menor aprendiz"), "menor-aprendiz");
});

test("a lista de níveis é conferida", () => {
  assert.equal(checkLevels([...DEFAULT_TEAM_LEVELS]), null);
  assert.match(checkLevels([]) ?? "", /pelo menos um/);
  assert.match(
    checkLevels([
      { id: "a", label: "Auxiliar" },
      { id: "b", label: "auxíliar" },
    ]) ?? "",
    /duas vezes/,
  );
  assert.match(checkLevels([{ id: "a", label: "   " }]) ?? "", /nome a cada/);
});

test("quem assina hoje cai no nível mais parecido", () => {
  const levels = [...DEFAULT_TEAM_LEVELS];
  assert.equal(guessLevel(levels, "Substituto legal"), "substituto-legal");
  assert.equal(guessLevel(levels, "Sub. Tabelião/Registrador"), "escrevente");
  assert.equal(
    guessLevel(levels, "escrevente autorizado do RI"),
    "escrevente-autorizado",
  );
  assert.equal(guessLevel(levels, "Tabelião e Registrador"), "tabeliao");
  assert.equal(guessLevel(levels, "Cargo que não existe"), "escrevente");
});

test("o que o visitante vê: só quem for marcado, foto só com autorização, portaria só anexada", () => {
  const full = publicPerson(person());
  assert.deepEqual(full, {
    id: "p1",
    name: "Elisa Exemplo Prado",
    levelId: "escrevente-autorizado",
    profession: "Bacharela em Direito",
    registration: "Portaria 006/2024",
    portariaDate: "2024-05-20",
    photo: true,
    portaria: true,
  });
  // Not marked: nobody sees them.
  assert.equal(publicPerson(person({ showOnSite: false })), null);
  assert.equal(publicPerson(person({ archived: true })), null);
  // No authorization: no photo.
  assert.equal(publicPerson(person({ imageConsent: false }))?.photo, false);
  // No file attached: the portaria's number and date stay hidden too.
  const sem = publicPerson(person({ hasPortaria: false }));
  assert.equal(sem?.portaria, false);
  assert.equal(sem?.registration, "");
  assert.equal(sem?.portariaDate, null);
  assert.equal(sem?.profession, "Bacharela em Direito");
});

test("o mosaico segue a ordem dos níveis e a da pessoa dentro do nível", () => {
  const levels = [...DEFAULT_TEAM_LEVELS];
  const groups = groupByLevel(levels, [
    person({ id: "a", name: "Zélia", levelId: "escrevente", position: 2 }),
    person({ id: "b", name: "Ana", levelId: "escrevente", position: 1 }),
    person({ id: "c", name: "Helena", levelId: "tabeliao", position: 1 }),
    person({ id: "d", name: "Perdida", levelId: "sumiu", position: 1 }),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.level.label, g.people.map((p) => p.name)]),
    [
      ["Tabelião e Registrador", ["Helena"]],
      ["Escrevente", ["Ana", "Zélia"]],
      ["Outros", ["Perdida"]],
    ],
  );
});

test("Quem assina lista quem pode assinar na ordem em que entrou, não na da hierarquia", () => {
  const levels = [...DEFAULT_TEAM_LEVELS];
  const signers = signersFrom(levels, [
    person({
      id: "1",
      name: "Terceira",
      levelId: "tabeliao",
      canSign: true,
      signerOrder: 3,
    }),
    person({
      id: "2",
      name: "Primeiro",
      levelId: "escrevente",
      canSign: true,
      signerOrder: 1,
      registration: "001/2010",
    }),
    person({
      id: "3",
      name: "Segunda",
      levelId: "substituto",
      canSign: true,
      signerOrder: 2,
    }),
    person({ id: "4", name: "Não assina", canSign: false, signerOrder: 4 }),
    person({
      id: "5",
      name: "Arquivado",
      canSign: true,
      signerOrder: 5,
      archived: true,
    }),
  ]);
  assert.deepEqual(signers, [
    { name: "Primeiro", title: "Escrevente", note: "001/2010" },
    { name: "Segunda", title: "Substituto", note: "Portaria 006/2024" },
    {
      name: "Terceira",
      title: "Tabelião e Registrador",
      note: "Portaria 006/2024",
    },
  ]);
});

test("o formulário da pessoa é conferido", () => {
  const ok = StaffInputSchema.safeParse({
    name: "  Ana Exemplo Ribeiro ",
    levelId: "substituto",
    profession: "",
    registration: "",
    portariaDate: "",
    showOnSite: false,
    imageConsent: false,
    canSign: false,
  });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.name, "Ana Exemplo Ribeiro");
  const bad = StaffInputSchema.safeParse({
    name: "A",
    levelId: "Tem espaço",
    profession: "x".repeat(81),
    registration: "",
    portariaDate: "20/05/2024",
    showOnSite: true,
    imageConsent: true,
    canSign: false,
  });
  assert.equal(bad.success, false);
});

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2,
]);
const pdf = new TextEncoder().encode("%PDF-1.4\n%fictício\n1 0 obj");
const docx = Uint8Array.from([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 8, 0, 0, 0, 1, 2,
]);

test("o tipo do arquivo vem do conteúdo, e cada campo aceita só o seu", () => {
  assert.equal(sniffTeamFile(png, "x.png"), "png");
  assert.equal(sniffTeamFile(pdf, "x.pdf"), "pdf");
  assert.equal(sniffTeamFile(docx, "portaria.docx"), "docx");
  // A zip that is not named .docx is not taken for a Word.
  assert.equal(sniffTeamFile(docx, "portaria.zip"), null);
  assert.equal(checkTeamFile("photo", png, "a.png").ok, true);
  assert.equal(checkTeamFile("portaria", pdf, "a.pdf").ok, true);
  assert.equal(checkTeamFile("word", docx, "a.docx").ok, true);
  // A PDF renamed .png is still a PDF, which a photo does not take.
  const wrong = checkTeamFile("photo", pdf, "foto.png");
  assert.equal(wrong.ok, false);
  assert.match(!wrong.ok ? wrong.message : "", /PNG, JPEG ou WebP/);
  // A Word in the portaria slot (which is the public PDF) is refused.
  assert.equal(checkTeamFile("portaria", docx, "a.docx").ok, false);
  assert.equal(checkTeamFile("photo", new Uint8Array(), "a.png").ok, false);
  const big = new Uint8Array(3 * 1024 * 1024);
  big.set(png);
  const tooBig = checkTeamFile("photo", big, "a.png");
  assert.equal(tooBig.ok, false);
  assert.match(!tooBig.ok ? tooBig.message : "", /até 2 MB/);
});
