import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attendanceToken,
  attendanceUrl,
  verifyAttendanceToken,
} from "./attendance-code.ts";

const ID = "3f2b8a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

test("a validation token checks out only for its office and appointment", () => {
  const token = attendanceToken("cartorio-a", ID);
  assert.equal(verifyAttendanceToken("cartorio-a", token), ID);
  // Another office's site does not vouch for it.
  assert.equal(verifyAttendanceToken("cartorio-b", token), undefined);
  // A code made up for another appointment fails.
  const [, code] = token.split(".");
  assert.equal(
    verifyAttendanceToken("cartorio-a", `${ID.replace("3f", "4f")}.${code}`),
    undefined,
  );
  assert.equal(verifyAttendanceToken("cartorio-a", "lixo"), undefined);
  assert.equal(
    attendanceUrl("https://x.com", "cartorio-a", ID),
    `https://x.com/comparecimento/${token}`,
  );
});
