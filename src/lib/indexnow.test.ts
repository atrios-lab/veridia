import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INDEXNOW_KEY,
  INDEXNOW_KEY_PATH,
  indexNowPayload,
} from "./indexnow.ts";

test("the key file's path is the key itself, plus .txt", () => {
  assert.equal(INDEXNOW_KEY_PATH, `/${INDEXNOW_KEY}.txt`);
  // IndexNow's own rule: 8 to 128 characters.
  assert.ok(INDEXNOW_KEY.length >= 8 && INDEXNOW_KEY.length <= 128);
});

test("the payload carries the host, the key and the full page URLs", () => {
  const payload = indexNowPayload("https://www.cartorioielmomarinhorn.com", [
    "/editais",
    "/transparencia",
  ]);
  assert.deepEqual(payload, {
    host: "www.cartorioielmomarinhorn.com",
    key: INDEXNOW_KEY,
    keyLocation: `https://www.cartorioielmomarinhorn.com${INDEXNOW_KEY_PATH}`,
    urlList: [
      "https://www.cartorioielmomarinhorn.com/editais",
      "https://www.cartorioielmomarinhorn.com/transparencia",
    ],
  });
});
