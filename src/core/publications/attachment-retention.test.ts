import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachmentServable,
  attachmentStatus,
} from "./attachment-retention.ts";

const base = { hasFile: true, purged: false, state: "archived" as const };

test("a file is kept for 30 days from the day it was sent", () => {
  const status = attachmentStatus(
    { ...base, uploadedOn: "2026-11-01" },
    "2026-11-08",
  );
  assert.deepEqual(status, {
    kind: "available",
    until: "2026-12-01",
    daysLeft: 23,
  });
  assert.equal(attachmentServable(status), true);
});

test("the last day still counts; the day after, an archived one expires", () => {
  const uploadedOn = "2026-10-01";
  assert.equal(
    attachmentStatus({ ...base, uploadedOn }, "2026-10-31").kind,
    "available",
  );
  const expired = attachmentStatus({ ...base, uploadedOn }, "2026-11-01");
  assert.equal(expired.kind, "expired");
  assert.equal(attachmentServable(expired), false);
});

test("drafts and scheduled ones expire like archived ones", () => {
  for (const state of ["draft", "scheduled"] as const) {
    assert.equal(
      attachmentStatus(
        { ...base, state, uploadedOn: "2026-09-01" },
        "2026-11-08",
      ).kind,
      "expired",
    );
  }
});

test("a live publication keeps its file until it leaves the site", () => {
  const held = attachmentStatus(
    { ...base, state: "live", uploadedOn: "2026-09-01" },
    "2026-11-08",
  );
  assert.equal(held.kind, "held");
  assert.equal(attachmentServable(held), true);
});

test("no file, or a file already deleted", () => {
  assert.equal(
    attachmentStatus(
      { ...base, hasFile: false, uploadedOn: null },
      "2026-11-08",
    ).kind,
    "none",
  );
  assert.equal(
    attachmentStatus(
      { ...base, hasFile: false, purged: true, uploadedOn: "2026-09-01" },
      "2026-11-08",
    ).kind,
    "purged",
  );
});
