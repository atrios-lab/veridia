import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COURSES_TENANT_ORIGIN,
  COURSES_TENANT_SLUG,
  coursesOrigin,
  isCoursesTenant,
} from "./courses-tenant.ts";
import { resolveTenant, TENANTS } from "./resolve.ts";

// The courses office: where it answers, that it is the only fictional
// office marked as a demonstration, and the address a cohort link carries.

const MISSING = "slug-que-nao-existe";

test("the courses office answers on its own hosts", () => {
  for (const host of ["curso.atrioss.com", "curso.localhost:3000"]) {
    const tenant = resolveTenant(host, MISSING);
    assert.equal(tenant.slug, COURSES_TENANT_SLUG, host);
    assert.ok(isCoursesTenant(tenant), host);
  }
});

test("a client office is never the courses office", () => {
  const marinho = resolveTenant("cartorioielmomarinhorn.com", MISSING);
  assert.equal(isCoursesTenant(marinho), false);
});

test("only the courses office is marked as a demonstration", () => {
  // Serra Verde is fictional too, but its site is recorded for the training
  // videos without the banner, so it stays unmarked.
  const marked = Object.values(TENANTS)
    .filter((tenant) => tenant.demo)
    .map((tenant) => tenant.slug);
  assert.deepEqual(marked, [COURSES_TENANT_SLUG]);
});

test("the courses office offers every attribution", () => {
  const tenant = TENANTS[COURSES_TENANT_SLUG];
  assert.equal(tenant.attributions.length, 6);
});

test("a cohort link points at the courses host", () => {
  assert.equal(
    coursesOrigin("https://cartorioielmomarinhorn.com"),
    COURSES_TENANT_ORIGIN,
  );
  assert.equal(
    coursesOrigin("https://veridia-git-x.vercel.app"),
    COURSES_TENANT_ORIGIN,
  );
  assert.equal(coursesOrigin("not a url"), COURSES_TENANT_ORIGIN);
});

test("in development the link stays on localhost, with the port", () => {
  assert.equal(
    coursesOrigin("http://demo.localhost:3000"),
    "http://curso.localhost:3000",
  );
  assert.equal(coursesOrigin("http://localhost"), "http://curso.localhost");
});
