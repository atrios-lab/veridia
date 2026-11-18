import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { DEFAULT_TEAM_LEVELS, type StaffInput } from "@/core/team/team.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  archiveStaffWith,
  clearFileWith,
  createStaffWith,
  getLevelsWith,
  importSignersWith,
  listStaffRowsWith,
  moveStaffWith,
  publicTeamWith,
  restoreStaffWith,
  saveLevelsWith,
  setFileWith,
  staffFileWith,
  TeamError,
  teamSignersWith,
  toRecord,
  updateStaffWith,
} from "./team.ts";

// Fictitious office and people only.
const OFFICE = "cartorio-equipe";
const OTHER = "cartorio-vizinho";
const ACTOR = "tabeliao";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const input = (over: Partial<StaffInput> = {}): StaffInput => ({
  name: "Elisa Exemplo Prado",
  levelId: "escrevente-autorizado",
  profession: "Bacharela em Direito",
  registration: "Portaria 006/2024",
  portariaDate: "2024-05-20",
  showOnSite: true,
  imageConsent: true,
  canSign: false,
  ...over,
});

test("os níveis começam no padrão e não saem enquanto tiverem gente", async () => {
  assert.deepEqual(await getLevelsWith(db, OFFICE), [...DEFAULT_TEAM_LEVELS]);
  const id = await createStaffWith(
    db,
    OFFICE,
    input({ name: "Paulo Fictício Gomes", levelId: "servicos-gerais" }),
    ACTOR,
  );
  const withoutLast = DEFAULT_TEAM_LEVELS.filter(
    (l) => l.id !== "servicos-gerais",
  );
  await assert.rejects(
    saveLevelsWith(db, OFFICE, withoutLast, ACTOR),
    /ainda tem pessoas/,
  );
  // Renaming and reordering are free.
  await saveLevelsWith(
    db,
    OFFICE,
    [
      { id: "servicos-gerais", label: "Serviços gerais e limpeza" },
      ...withoutLast,
      { id: "estagiario", label: "Estagiário" },
    ],
    ACTOR,
  );
  const levels = await getLevelsWith(db, OFFICE);
  assert.equal(levels[0]?.label, "Serviços gerais e limpeza");
  assert.equal(levels.at(-1)?.id, "estagiario");
  // Another office keeps its own.
  assert.deepEqual(await getLevelsWith(db, OTHER), [...DEFAULT_TEAM_LEVELS]);
  await archiveStaffWith(db, OFFICE, id, ACTOR);
  // Archived people still hold their level.
  await assert.rejects(
    saveLevelsWith(db, OFFICE, withoutLast, ACTOR),
    /ainda tem pessoas/,
  );
});

test("a pessoa só tem nível que existe, e cada cartório vê só os seus", async () => {
  await assert.rejects(
    createStaffWith(db, OFFICE, input({ levelId: "nao-existe" }), ACTOR),
    /nível da lista/,
  );
  await assert.rejects(
    createStaffWith(db, OFFICE, input({ name: "A" }), ACTOR),
    TeamError,
  );
  const mine = await createStaffWith(
    db,
    OFFICE,
    input({ name: "Hugo Fictício Reis", levelId: "escrevente" }),
    ACTOR,
  );
  await createStaffWith(
    db,
    OTHER,
    input({ name: "Outra Pessoa Exemplo", levelId: "escrevente" }),
    ACTOR,
  );
  const names = (await listStaffRowsWith(db, OFFICE)).map((r) => r.name);
  assert.ok(names.includes("Hugo Fictício Reis"));
  assert.ok(!names.includes("Outra Pessoa Exemplo"));
  // A person of another office cannot be reached by id.
  await assert.rejects(
    updateStaffWith(db, OTHER, mine, input(), ACTOR),
    /não encontrada/,
  );
});

test("o site mostra só quem foi marcado; foto só com autorização; portaria só anexada", async () => {
  const office = "cartorio-site";
  const id = await createStaffWith(db, office, input(), ACTOR);
  const hidden = await createStaffWith(
    db,
    office,
    input({
      name: "Quitéria Exemplo Lopes",
      levelId: "servicos-gerais",
      showOnSite: false,
    }),
    ACTOR,
  );
  await setFileWith(
    db,
    office,
    id,
    "photo",
    { path: "/tmp/foto.png", name: "foto.png", mime: "image/png" },
    ACTOR,
  );
  await setFileWith(
    db,
    office,
    id,
    "word",
    { path: "/tmp/p.docx", name: "p.docx", mime: "application/msword" },
    ACTOR,
  );
  // No portaria file yet: name, level and profession only.
  let site = await publicTeamWith(db, office);
  assert.deepEqual(
    site.groups.map((g) => g.people.map((p) => p.name)),
    [["Elisa Exemplo Prado"]],
  );
  let shown = site.groups[0]?.people[0];
  assert.equal(shown?.photo, true);
  assert.equal(shown?.portaria, false);
  assert.equal(shown?.registration, "");
  assert.equal(shown?.profession, "Bacharela em Direito");

  // Attaching the portaria publishes it, with its number and date.
  await setFileWith(
    db,
    office,
    id,
    "portaria",
    {
      path: "/tmp/portaria.pdf",
      name: "portaria-006.pdf",
      mime: "application/pdf",
    },
    ACTOR,
  );
  site = await publicTeamWith(db, office);
  shown = site.groups[0]?.people[0];
  assert.equal(shown?.portaria, true);
  assert.equal(shown?.registration, "Portaria 006/2024");
  assert.equal(shown?.portariaDate, "2024-05-20");

  // The files: the Word never goes out; the hidden person has nothing public.
  assert.equal(
    await staffFileWith(db, office, id, "word", { publicOnly: true }),
    null,
  );
  assert.ok(await staffFileWith(db, office, id, "word", { publicOnly: false }));
  assert.equal(
    (await staffFileWith(db, office, id, "portaria", { publicOnly: true }))
      ?.mime,
    "application/pdf",
  );
  assert.equal(
    await staffFileWith(db, office, hidden, "photo", { publicOnly: true }),
    null,
  );

  // Withdrawing the image authorization takes the photo off the site at once.
  await updateStaffWith(db, office, id, input({ imageConsent: false }), ACTOR);
  site = await publicTeamWith(db, office);
  assert.equal(site.groups[0]?.people[0]?.photo, false);
  assert.equal(
    await staffFileWith(db, office, id, "photo", { publicOnly: true }),
    null,
  );
  // ... and the panel still has it.
  assert.ok(
    await staffFileWith(db, office, id, "photo", { publicOnly: false }),
  );

  // Taking the portaria off hides its number and date again.
  const gone = await clearFileWith(db, office, id, "portaria", ACTOR);
  assert.equal(gone, "/tmp/portaria.pdf");
  site = await publicTeamWith(db, office);
  assert.equal(site.groups[0]?.people[0]?.portaria, false);
  assert.equal(site.groups[0]?.people[0]?.registration, "");

  // Archived: gone from the site, kept in the panel's record.
  await archiveStaffWith(db, office, id, ACTOR);
  assert.deepEqual((await publicTeamWith(db, office)).groups, []);
  assert.equal(
    (await listStaffRowsWith(db, office, { archived: true })).length,
    2,
  );
  assert.equal((await listStaffRowsWith(db, office)).length, 1);
  await restoreStaffWith(db, office, id, ACTOR);
  assert.equal((await listStaffRowsWith(db, office)).length, 2);
});

test("a pessoa sobe e desce dentro do nível, e quem muda de nível vai para o fim", async () => {
  const office = "cartorio-ordem";
  const a = await createStaffWith(
    db,
    office,
    input({ name: "Ana Um", levelId: "escrevente" }),
    ACTOR,
  );
  const b = await createStaffWith(
    db,
    office,
    input({ name: "Bruno Dois", levelId: "escrevente" }),
    ACTOR,
  );
  const c = await createStaffWith(
    db,
    office,
    input({ name: "Carla Três", levelId: "escrevente" }),
    ACTOR,
  );
  const order = async () =>
    (await publicTeamWith(db, office)).groups[0]?.people.map((p) => p.name);
  assert.deepEqual(await order(), ["Ana Um", "Bruno Dois", "Carla Três"]);
  await moveStaffWith(db, office, c, "up", ACTOR);
  assert.deepEqual(await order(), ["Ana Um", "Carla Três", "Bruno Dois"]);
  await moveStaffWith(db, office, a, "up", ACTOR); // already first: nothing
  assert.deepEqual(await order(), ["Ana Um", "Carla Três", "Bruno Dois"]);
  await moveStaffWith(db, office, a, "down", ACTOR);
  assert.deepEqual(await order(), ["Carla Três", "Ana Um", "Bruno Dois"]);
  await updateStaffWith(
    db,
    office,
    c,
    input({ name: "Carla Três", levelId: "auxiliar" }),
    ACTOR,
  );
  const groups = (await publicTeamWith(db, office)).groups;
  assert.deepEqual(
    groups.map((g) => [g.level.id, g.people.map((p) => p.name)]),
    [
      ["escrevente", ["Ana Um", "Bruno Dois"]],
      ["auxiliar", ["Carla Três"]],
    ],
  );
  void b;
});

test("Quem assina vem da equipe na ordem em que as pessoas entraram, e o que existia hoje vira o começo", async () => {
  const office = "cartorio-assina";
  assert.deepEqual(await teamSignersWith(db, office), []);
  // The old list: two people, as the documents know them (by place).
  const legacy = [
    {
      name: "Carlos Fictício Lima",
      title: "Substituto legal",
      note: "001/2010",
    },
    { name: "Ana Exemplo Ribeiro", title: "Substituta", note: "002/2012" },
  ];
  // Ana already in the team: she is marked, not copied.
  await createStaffWith(
    db,
    office,
    input({
      name: "Ana Exemplo Ribeiro",
      levelId: "substituto",
      registration: "",
    }),
    ACTOR,
  );
  assert.equal(await importSignersWith(db, office, legacy, ACTOR), 2);
  const signers = await teamSignersWith(db, office);
  assert.deepEqual(
    signers.map((s) => [s.name, s.title, s.note]),
    [
      ["Carlos Fictício Lima", "Substituto legal", "001/2010"],
      ["Ana Exemplo Ribeiro", "Substituto", "002/2012"],
    ],
  );
  const rows = await listStaffRowsWith(db, office);
  assert.equal(rows.length, 2);
  // Brought in, they stay off the site until marked.
  assert.equal(
    rows.every(
      (r) => r.showOnSite === false || r.name === "Ana Exemplo Ribeiro",
    ),
    true,
  );
  // Cannot be brought twice.
  await assert.rejects(
    importSignersWith(db, office, legacy, ACTOR),
    /já tem quem assina/,
  );

  // Someone new marked "Pode assinar" goes to the end, whatever their level.
  await createStaffWith(
    db,
    office,
    input({
      name: "Helena Exemplo de Souza",
      levelId: "tabeliao",
      canSign: true,
    }),
    ACTOR,
  );
  assert.deepEqual(
    (await teamSignersWith(db, office)).map((s) => s.name),
    ["Carlos Fictício Lima", "Ana Exemplo Ribeiro", "Helena Exemplo de Souza"],
  );
  // Archiving takes a signer off the list.
  const helena = (await listStaffRowsWith(db, office)).find((r) =>
    r.name.startsWith("Helena"),
  );
  assert.ok(helena);
  await archiveStaffWith(db, office, helena.id, ACTOR);
  assert.deepEqual(
    (await teamSignersWith(db, office)).map((s) => s.name),
    ["Carlos Fictício Lima", "Ana Exemplo Ribeiro"],
  );
  assert.equal(toRecord(helena).canSign, true);
});

test("o enquadramento da foto é guardado e chega ao site", async () => {
  const office = "cartorio-moldura";
  const id = await createStaffWith(db, office, input(), ACTOR);
  // Without a choice: the centred circle.
  let shown = (await publicTeamWith(db, office)).groups[0]?.people[0];
  assert.equal(shown?.frame.shape, "circle");
  assert.equal(shown?.frame.zoom, 100);
  const frame = {
    shape: "square",
    fit: "cover",
    x: 40,
    y: 10,
    zoom: 180,
  } as const;
  await updateStaffWith(db, office, id, input({ frame }), ACTOR);
  shown = (await publicTeamWith(db, office)).groups[0]?.people[0];
  assert.deepEqual(shown?.frame, frame);
  // A frame out of range is refused and changes nothing.
  await assert.rejects(
    updateStaffWith(
      db,
      office,
      id,
      input({ frame: { ...frame, x: 140 } }),
      ACTOR,
    ),
    TeamError,
  );
  const [row] = await listStaffRowsWith(db, office);
  assert.deepEqual(toRecord(row as NonNullable<typeof row>).frame, frame);
});
