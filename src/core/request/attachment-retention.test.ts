import assert from "node:assert/strict";
import { test } from "node:test";
import {
  requestFileDueSoon,
  requestFileServable,
  requestFileStatus,
} from "./attachment-retention.ts";

const file = { hasFile: true, purged: false, uploadedOn: "2026-06-01" };

test("nothing goes while the protocol is open, however old the file", () => {
  const status = requestFileStatus({ ...file, closedOn: null }, "2026-11-08");
  assert.deepEqual(status, { kind: "held" });
  assert.equal(requestFileServable(status), true);
  assert.equal(requestFileDueSoon(status), false);
});

test("a closed protocol keeps its files for 30 days from the closing", () => {
  const status = requestFileStatus(
    { ...file, closedOn: "2026-11-01" },
    "2026-11-08",
  );
  assert.deepEqual(status, {
    kind: "available",
    until: "2026-12-01",
    daysLeft: 23,
  });
  assert.equal(requestFileServable(status), true);
  assert.equal(requestFileDueSoon(status), false);
});

test("the last day still counts; the day after, the file expires", () => {
  const closed = { ...file, closedOn: "2026-10-01" };
  const last = requestFileStatus(closed, "2026-10-31");
  assert.equal(last.kind, "available");
  assert.equal(requestFileDueSoon(last), true);
  const expired = requestFileStatus(closed, "2026-11-01");
  assert.deepEqual(expired, { kind: "expired", until: "2026-10-31" });
  assert.equal(requestFileServable(expired), false);
});

test("the last 7 days are flagged for the office", () => {
  const closed = { ...file, closedOn: "2026-10-10" };
  assert.equal(
    requestFileDueSoon(requestFileStatus(closed, "2026-11-01")),
    false,
  );
  assert.equal(
    requestFileDueSoon(requestFileStatus(closed, "2026-11-02")),
    true,
  );
});

test("a file sent after the closing gets 30 days from its own sending", () => {
  const status = requestFileStatus(
    { ...file, uploadedOn: "2026-11-05", closedOn: "2026-10-01" },
    "2026-11-08",
  );
  assert.deepEqual(status, {
    kind: "available",
    until: "2026-12-05",
    daysLeft: 27,
  });
});

test("a purged file stays purged; a row with no file is none", () => {
  assert.deepEqual(
    requestFileStatus(
      { ...file, hasFile: false, purged: true, closedOn: "2026-01-01" },
      "2026-11-08",
    ),
    { kind: "purged" },
  );
  assert.equal(
    requestFileServable(
      requestFileStatus(
        { ...file, hasFile: false, purged: true, closedOn: null },
        "2026-11-08",
      ),
    ),
    false,
  );
  assert.deepEqual(
    requestFileStatus(
      { ...file, hasFile: false, closedOn: "2026-11-01" },
      "2026-11-08",
    ),
    { kind: "none" },
  );
});
