import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyTenantOverrides,
  OfficeBrandSchema,
  OfficeContactSchema,
  OfficeDeadlineSchema,
  OfficeDpoSchema,
  OfficePixSchema,
} from "./overrides.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";

const FULL = {
  openingHours: "Segunda a sexta, das 9h às 17h",
  contacts: {
    phone: "(84) 3000-0000",
    whatsapp: "(84) 99000-0000",
    email: "contato@serventia.example",
  },
};

const FULL_BRAND = {
  theme: "marinho-bronze",
  logos: cartorioMarinho.logos,
  heroImage: "/nova-foto.jpg",
  home: { eyebrow: "Novo eyebrow", title: "Novo título" },
  disabledSections: ["editais"],
};

const FULL_DPO = {
  dpo: { name: "Nova Pessoa Encarregada", email: "dpo@serventia.example" },
};

const FULL_PIX = {
  pix: { type: "email", key: "financeiro@serventia.example" },
};

test("a complete override replaces both blocks", () => {
  const merged = applyTenantOverrides(cartorioMarinho, { contact: FULL });
  assert.equal(merged.openingHours, FULL.openingHours);
  assert.equal(merged.contacts.phone, "(84) 3000-0000");
  // And nothing else moved.
  assert.equal(merged.name, cartorioMarinho.name);
  assert.equal(merged.cns, cartorioMarinho.cns);
});

test("a partial override leaves the other block on the config value", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    contact: { openingHours: "Segunda a quinta, das 8h às 12h" },
  });
  assert.equal(merged.openingHours, "Segunda a quinta, das 8h às 12h");
  assert.deepEqual(merged.contacts, cartorioMarinho.contacts);
});

test("no override at all means the config, untouched", () => {
  for (const raw of [null, undefined, {}]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { contact: raw }), {
      ...cartorioMarinho,
    });
  }
  assert.deepEqual(applyTenantOverrides(cartorioMarinho, {}), {
    ...cartorioMarinho,
  });
});

test("a corrupted row is ignored instead of thrown", () => {
  // The public site has to stay up on the config alone. Every one of these
  // used to be a way to take it down.
  for (const raw of [
    "not json at all",
    42,
    { contacts: "(84) 3000-0000" },
    { contacts: { phone: "(84) 3000-0000" } }, // half a contacts block
    { openingHours: "" },
    { contacts: { ...FULL.contacts, email: "contato@" } },
  ]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { contact: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("a structural field smuggled into the row cannot reach the tenant", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    contact: {
      ...FULL,
      name: "Cartório de Outra Pessoa",
      cns: "999999",
      slug: "outra-serventia",
      attributions: ["RCPN"],
    },
  });
  assert.equal(merged.name, cartorioMarinho.name);
  assert.equal(merged.cns, cartorioMarinho.cns);
  assert.equal(merged.slug, cartorioMarinho.slug);
  assert.deepEqual(merged.attributions, cartorioMarinho.attributions);
});

test("the write schema demands every field", () => {
  assert.ok(OfficeContactSchema.safeParse(FULL).success);
  for (const bad of [
    { ...FULL, openingHours: "" },
    { ...FULL, contacts: { ...FULL.contacts, email: "contato@" } },
    { ...FULL, contacts: { ...FULL.contacts, phone: "" } },
    { contacts: FULL.contacts },
    { openingHours: FULL.openingHours },
  ]) {
    assert.equal(OfficeContactSchema.safeParse(bad).success, false);
  }
});

test("a complete brand override replaces theme, logos, hero and home", () => {
  const merged = applyTenantOverrides(cartorioMarinho, { brand: FULL_BRAND });
  assert.equal(merged.theme, "marinho-bronze");
  assert.equal(merged.heroImage, "/nova-foto.jpg");
  assert.deepEqual(merged.home, FULL_BRAND.home);
  assert.deepEqual(merged.disabledSections, ["editais"]);
  // And nothing else moved.
  assert.equal(merged.name, cartorioMarinho.name);
});

test("the contact and brand rows are independent", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    contact: { openingHours: "Segunda a quinta, das 8h às 12h" },
    brand: "not json at all",
  });
  assert.equal(merged.openingHours, "Segunda a quinta, das 8h às 12h");
  assert.equal(merged.theme, cartorioMarinho.theme);

  const otherWay = applyTenantOverrides(cartorioMarinho, {
    contact: "not json at all",
    brand: { theme: "marinho-bronze" },
  });
  assert.equal(otherWay.openingHours, cartorioMarinho.openingHours);
  assert.equal(otherWay.theme, "marinho-bronze");
});

test("no brand override at all means the config, untouched", () => {
  for (const raw of [null, undefined, {}]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { brand: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("the write schema rejects a theme outside the offered five", () => {
  assert.equal(
    OfficeBrandSchema.safeParse({ ...FULL_BRAND, theme: "roxo-neon" }).success,
    false,
  );
});

test("the write schema rejects a mandatory section marked disabled", () => {
  for (const mandatory of [
    "inicio",
    "dpo-lgpd",
    "ouvidoria",
    "transparencia",
  ]) {
    assert.equal(
      OfficeBrandSchema.safeParse({
        ...FULL_BRAND,
        disabledSections: [mandatory],
      }).success,
      false,
      mandatory,
    );
  }
});

test("a mandatory section smuggled into a raw row is ignored", () => {
  // Same defence as the structural-field test above, one layer down: even a
  // row written by hand, bypassing OfficeBrandSchema entirely, must not take
  // a legally required channel off the air.
  const merged = applyTenantOverrides(cartorioMarinho, {
    brand: { ...FULL_BRAND, disabledSections: ["ouvidoria"] },
  });
  assert.deepEqual(merged, { ...cartorioMarinho });
});

test("a structural field smuggled into the brand row cannot reach the tenant", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    brand: {
      ...FULL_BRAND,
      name: "Cartório de Outra Pessoa",
      attributions: ["RCPN"],
    },
  });
  assert.equal(merged.name, cartorioMarinho.name);
  assert.deepEqual(merged.attributions, cartorioMarinho.attributions);
  assert.equal(merged.theme, "marinho-bronze"); // the rest of the row still lands
});

test("a complete DPO override replaces name and e-mail", () => {
  const merged = applyTenantOverrides(cartorioMarinho, { dpo: FULL_DPO });
  assert.deepEqual(merged.dpo, FULL_DPO.dpo);
  // And nothing else moved.
  assert.equal(merged.name, cartorioMarinho.name);
});

test("no DPO override at all means the config, untouched", () => {
  for (const raw of [null, undefined, {}]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { dpo: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("a corrupted DPO row is ignored instead of thrown", () => {
  for (const raw of [
    "not json at all",
    { dpo: { name: "Só o nome" } },
    { dpo: { name: "Nome", email: "dpo.serventia" } },
  ]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { dpo: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("the DPO write schema demands both fields, valid", () => {
  assert.ok(OfficeDpoSchema.safeParse(FULL_DPO).success);
  assert.equal(
    OfficeDpoSchema.safeParse({ dpo: { ...FULL_DPO.dpo, name: "" } }).success,
    false,
  );
  assert.equal(
    OfficeDpoSchema.safeParse({
      dpo: { ...FULL_DPO.dpo, email: "dpo.serventia" },
    }).success,
    false,
  );
});

test("a complete Pix override replaces type and key", () => {
  const merged = applyTenantOverrides(cartorioMarinho, { pix: FULL_PIX });
  assert.deepEqual(merged.pix, FULL_PIX.pix);
  assert.equal(merged.name, cartorioMarinho.name);
});

test("no Pix override at all means the config, untouched", () => {
  for (const raw of [null, undefined, {}]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { pix: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("a corrupted Pix row is ignored instead of thrown", () => {
  for (const raw of [
    "not json at all",
    { pix: { type: "email", key: "financeiro.serventia" } }, // fails the shape's own refine
    { pix: { type: "outro-tipo", key: "x" } },
  ]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { pix: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("the Pix write schema validates the key against its own type", () => {
  assert.ok(OfficePixSchema.safeParse(FULL_PIX).success);
  assert.equal(
    OfficePixSchema.safeParse({
      pix: { type: "cpf", key: "111.111.111-11" },
    }).success,
    false,
  );
});

test("all override rows are independent", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    contact: { openingHours: "Segunda a quinta, das 8h às 12h" },
    brand: "not json at all",
    dpo: FULL_DPO,
    pix: "not json at all",
    deadline: { requestDeadlineDays: 45 },
  });
  assert.equal(merged.openingHours, "Segunda a quinta, das 8h às 12h");
  assert.equal(merged.theme, cartorioMarinho.theme);
  assert.deepEqual(merged.dpo, FULL_DPO.dpo);
  assert.deepEqual(merged.pix, cartorioMarinho.pix);
  assert.equal(merged.requestDeadlineDays, 45);
});

test("a deadline override replaces the office's default term", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    deadline: { requestDeadlineDays: 45 },
  });
  assert.equal(merged.requestDeadlineDays, 45);
  assert.equal(merged.name, cartorioMarinho.name);
});

test("no deadline override at all means the config, untouched", () => {
  for (const raw of [null, undefined, {}]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { deadline: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("a corrupted or out-of-range deadline row is ignored instead of thrown", () => {
  for (const raw of [
    "not json at all",
    { requestDeadlineDays: 0 },
    { requestDeadlineDays: 400 },
    { requestDeadlineDays: "trinta" },
  ]) {
    assert.deepEqual(applyTenantOverrides(cartorioMarinho, { deadline: raw }), {
      ...cartorioMarinho,
    });
  }
});

test("the deadline write schema cannot reach anything else in the tenant", () => {
  const parsed = OfficeDeadlineSchema.safeParse({
    requestDeadlineDays: 20,
    name: "Cartório Forjado",
    attributions: ["RI"],
  });
  assert.ok(parsed.success);
  assert.deepEqual(parsed.data, { requestDeadlineDays: 20 });
});

test("as horas do balcão são editáveis pelo painel", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    contact: {
      openingHours: "Segunda a sexta, das 8h às 17h",
      counterHours: { startHour: 8, endHour: 17 },
    },
  });
  assert.equal(merged.counterHours.endHour, 17);
  assert.equal(merged.openingHours, "Segunda a sexta, das 8h às 17h");
});

test("uma linha antiga não devolve o horário para o padrão", () => {
  // Rows written before the hours were editable carry no `counterHours`. The
  // default on `TenantSchema` used to be reached through `.partial()` and
  // wrote 8h-14h over whatever the office actually keeps; every office whose
  // hours are not 8h-14h would have been moved without anyone touching it.
  const office = {
    ...cartorioMarinho,
    counterHours: { startHour: 9, endHour: 17 },
  };
  const merged = applyTenantOverrides(office, {
    contact: { openingHours: "Segunda a sexta, das 9h às 17h" },
  });
  assert.deepEqual(merged.counterHours, { startHour: 9, endHour: 17 });
});

test("fechar antes de abrir é recusado", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    contact: { counterHours: { startHour: 14, endHour: 8 } },
  });
  // A malformed row is noise over a base that is always valid: the office
  // keeps its own hours rather than the site taking an impossible window.
  assert.deepEqual(merged.counterHours, cartorioMarinho.counterHours);
});
