import assert from "node:assert/strict";
import { test } from "node:test";
import {
  jurisdictionLine,
  officeIdentification,
  officeWithJurisdiction,
  officialName,
  serviceLine,
} from "./identification.ts";
import { applyTenantOverrides } from "./overrides.ts";
import { TENANTS } from "./resolve.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";

test("cabeçalho de Ielmo Marinho como nas certidões da serventia", () => {
  const id = officeIdentification(cartorioMarinho);
  assert.deepEqual(id.header, [
    "REPÚBLICA FEDERATIVA DO BRASIL",
    "SERVIÇO NOTARIAL E REGISTRAL",
    "CARTÓRIO DO OFÍCIO ÚNICO DE IELMO MARINHO/RN",
    "COMARCA/TERMO DE MACAÍBA/RN",
  ]);
  assert.equal(id.missingJurisdiction, false);
  // As on the office's certidões: no holder, no attributions, by default.
  assert.equal(id.holder, undefined);
  assert.equal(id.attributions, undefined);
  assert.deepEqual(id.footer, [
    "Rua José Camilo Bezerra, 44, Centro, Ielmo Marinho / RN, 59490-000",
    "Fone (84) 4042-0940 · E-mail: contato@cartorioielmomarinhorn.com · cartorioielmomarinhorn.com",
  ]);
});

test("sem comarca configurada, o cabeçalho omite a linha e avisa", () => {
  const { jurisdiction: _ignored, ...rest } = cartorioMarinho;
  const id = officeIdentification(rest);
  assert.equal(id.header.length, 3);
  assert.equal(id.missingJurisdiction, true);
});

test("comarca, termo ou os dois, com a UF da serventia", () => {
  const base = { location: cartorioMarinho.location };
  assert.equal(
    jurisdictionLine({
      ...base,
      jurisdiction: { kind: "comarca", seat: "Natal" },
    }),
    "Comarca de Natal/RN",
  );
  assert.equal(
    jurisdictionLine({
      ...base,
      jurisdiction: { kind: "termo", seat: "Macaíba" },
    }),
    "Termo de Macaíba/RN",
  );
  assert.equal(
    officeWithJurisdiction(cartorioMarinho),
    "Cartório do Ofício Único de Ielmo Marinho/RN, Comarca/Termo de Macaíba/RN",
  );
});

test("serviço notarial, registral ou os dois, pelas atribuições", () => {
  assert.equal(serviceLine(["NOTAS", "RCPN"]), "Serviço Notarial e Registral");
  assert.equal(serviceLine(["NOTAS", "PROTESTO"]), "Serviço Notarial");
  assert.equal(serviceLine(["RCPN"]), "Serviço Registral");
});

test("o painel muda a comarca e o cargo; nome e atribuições não", () => {
  const merged = applyTenantOverrides(cartorioMarinho, {
    identification: {
      jurisdiction: { kind: "comarca", seat: "Macaíba" },
      holderTitle: "Tabeliã e Registradora",
      attributions: ["RCPN"],
      name: "Outro",
    },
  });
  assert.deepEqual(merged.jurisdiction, { kind: "comarca", seat: "Macaíba" });
  assert.equal(merged.holderTitle, "Tabeliã e Registradora");
  assert.deepEqual(merged.attributions, cartorioMarinho.attributions);
  assert.equal(merged.name, cartorioMarinho.name);
});

test("nome do titular e atribuições só quando a serventia marca", () => {
  const id = officeIdentification({
    ...cartorioMarinho,
    showHolder: true,
    showAttributions: true,
    holderTitle: "Tabeliã e Registradora",
  });
  assert.equal(id.holder, "Maria Marreiro de Lima, Tabeliã e Registradora");
  assert.match(
    id.attributions ?? "",
    /^Registro Civil das Pessoas Naturais · /,
  );
  // A holder the platform has not confirmed is never printed.
  const unconfirmed = officeIdentification({
    ...cartorioMarinho,
    showHolder: true,
    owner: { name: "Fulano", status: "a confirmar" },
  });
  assert.equal(unconfirmed.holder, undefined);
});

test("a serventia pode escolher não mostrar a comarca", () => {
  const id = officeIdentification({
    ...cartorioMarinho,
    jurisdiction: { kind: "none" },
  });
  assert.equal(id.header.length, 3);
  assert.equal(id.missingJurisdiction, false);
});

test("cada serventia sai com os próprios dados, sem nada de outra", () => {
  const tenants = Object.values(TENANTS);
  for (const tenant of tenants) {
    const id = officeIdentification(tenant);
    const printed = [...id.header, id.holder, id.attributions, ...id.footer]
      .filter(Boolean)
      .join("\n");
    assert.ok(
      id.header.includes(officialName(tenant).toLocaleUpperCase("pt-BR")),
      tenant.slug,
    );
    if (tenant.address)
      assert.ok(id.footer.includes(tenant.address), tenant.slug);
    assert.match(
      printed,
      new RegExp(tenant.contacts.phone.replace(/[()]/g, "\\$&")),
      tenant.slug,
    );
    for (const other of tenants) {
      if (other.slug === tenant.slug) continue;
      // Another office's address, e-mail or site never reaches this paper.
      for (const value of [
        other.address,
        other.contacts.email,
        ...other.hosts,
      ]) {
        if (!value || value.endsWith(".localhost")) continue;
        if (tenant.address === value || tenant.contacts.email === value)
          continue;
        if (tenant.hosts.includes(value)) continue;
        assert.ok(!printed.includes(value), `${tenant.slug} imprime ${value}`);
      }
    }
  }
});

test("o nome do titular é o que a serventia digitou, quando muda de tabelião", () => {
  const id = officeIdentification({
    ...cartorioMarinho,
    showHolder: true,
    holderName: "José Novo Tabelião",
    holderTitle: "Tabelião e Registrador",
  });
  assert.equal(id.holder, "José Novo Tabelião, Tabelião e Registrador");
  // Typed by the office, it prints even when the court's record is pending.
  const pending = officeIdentification({
    ...cartorioMarinho,
    showHolder: true,
    holderName: "José Novo Tabelião",
    owner: { name: "Fulano", status: "a confirmar" },
  });
  assert.equal(pending.holder, "José Novo Tabelião, Titular");
});

test("o rodapé escrito pela serventia substitui o automático", () => {
  const id = officeIdentification({
    ...cartorioMarinho,
    footerLines: ["Rua Nova, 1, Centro", "Fone (84) 0000-0000"],
  });
  assert.deepEqual(id.footer, ["Rua Nova, 1, Centro", "Fone (84) 0000-0000"]);
  assert.equal(
    officeIdentification({ ...cartorioMarinho, footerLines: [] }).footer.length,
    2,
  );
});

test("a UF da comarca pode ser outra que a do cadastro", () => {
  assert.equal(
    jurisdictionLine({
      location: cartorioMarinho.location,
      jurisdiction: { kind: "comarca", seat: "Juazeiro", uf: "BA" },
    }),
    "Comarca de Juazeiro/BA",
  );
});
