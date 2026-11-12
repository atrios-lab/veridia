import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareWithBaseline,
  countOneOffs,
  isScannedFile,
  lowerBaseline,
} from "./admin-scale.ts";

describe("countOneOffs", () => {
  it("counts each one-off size, radius, spacing and serif", () => {
    const source = `
      <p className="text-[13px] tracking-[0.08em] font-serif">a</p>
      <div className="rounded-[10px] md:text-[15px] rounded-t-[6px]" />
    `;
    assert.equal(countOneOffs(source), 6);
  });

  it("ignores the scale's own classes", () => {
    const source = `<p className="text-sm text-muted-foreground rounded-lg tracking-tight font-sans">a</p>`;
    assert.equal(countOneOffs(source), 0);
  });

  it("does not read a longer class name as the serif", () => {
    assert.equal(countOneOffs(`className="font-serif-display"`), 0);
  });
});

describe("isScannedFile", () => {
  it("scans panel sources", () => {
    assert.equal(isScannedFile("src/app/admin/_components/sidebar.tsx"), true);
    assert.equal(isScannedFile("src/app/admin/_components/nav.ts"), true);
  });

  it("skips tests, the public site and the site previews", () => {
    assert.equal(isScannedFile("src/app/admin/_components/nav.test.ts"), false);
    assert.equal(isScannedFile("src/app/(public)/page.tsx"), false);
    assert.equal(
      isScannedFile(
        "src/app/admin/(dashboard)/publicacoes/_components/preview.tsx",
      ),
      false,
    );
  });
});

describe("compareWithBaseline", () => {
  it("fails a new file that has any one-off", () => {
    const { failures } = compareWithBaseline({ "new.tsx": 1 }, {});
    assert.deepEqual(failures, [{ file: "new.tsx", count: 1, allowed: 0 }]);
  });

  it("fails an old file that gained one-offs", () => {
    const { failures } = compareWithBaseline(
      { "old.tsx": 5 },
      { "old.tsx": 4 },
    );
    assert.deepEqual(failures, [{ file: "old.tsx", count: 5, allowed: 4 }]);
  });

  it("passes an old file that lost one-offs and reports it", () => {
    const { failures, improved } = compareWithBaseline(
      { "old.tsx": 2 },
      { "old.tsx": 4 },
    );
    assert.deepEqual(failures, []);
    assert.deepEqual(improved, [{ file: "old.tsx", count: 2, allowed: 4 }]);
  });

  it("treats a deleted file as cleaned up", () => {
    const { failures, improved } = compareWithBaseline({}, { "gone.tsx": 3 });
    assert.deepEqual(failures, []);
    assert.deepEqual(improved, [{ file: "gone.tsx", count: 0, allowed: 3 }]);
  });

  it("passes a clean new file", () => {
    const result = compareWithBaseline({ "new.tsx": 0 }, {});
    assert.deepEqual(result, { failures: [], improved: [] });
  });
});

describe("lowerBaseline", () => {
  it("only ever lowers, drops zeros and never adds a file", () => {
    const next = lowerBaseline(
      { "a.tsx": 2, "b.tsx": 9, "c.tsx": 0, "new.tsx": 4 },
      { "a.tsx": 5, "b.tsx": 3, "c.tsx": 1, "gone.tsx": 2 },
    );
    assert.deepEqual(next, { "a.tsx": 2, "b.tsx": 3 });
  });
});
