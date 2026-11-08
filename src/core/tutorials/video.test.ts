import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkTutorialFile,
  courseFormSchema,
  isGeneratedTutorialPath,
  isStoredTutorialUrl,
  MAX_CAPTIONS_BYTES,
  MAX_DIRECT_BYTES,
  MAX_POSTER_BYTES,
  MAX_TUTORIAL_DESCRIPTION,
  MAX_VIDEO_BYTES_DIRECT,
  tutorialFilePath,
  tutorialFormSchema,
  tutorialPathKind,
  tutorialPathMimeType,
} from "./video.ts";

const ID = "0f1e2d3c-4b5a-4968-8776-655443322110";
const HOST = "abc123.public.blob.vercel-storage.com";

test("a generated path is the folder, the id and the kind's extension", () => {
  assert.equal(tutorialFilePath("video", ID), `treinamento/${ID}.mp4`);
  assert.equal(tutorialFilePath("captions", ID), `treinamento/${ID}.vtt`);
  assert.ok(isGeneratedTutorialPath(tutorialFilePath("video", ID)));
  assert.ok(isGeneratedTutorialPath(tutorialFilePath("captions", ID)));
});

test("a path the system would not have produced is refused", () => {
  assert.equal(isGeneratedTutorialPath(`anexos/${ID}.mp4`), false);
  assert.equal(isGeneratedTutorialPath(`treinamento/${ID}.mov`), false);
  assert.equal(isGeneratedTutorialPath("treinamento/qualquer.mp4"), false);
  assert.equal(isGeneratedTutorialPath(`treinamento/../${ID}.mp4`), false);
  assert.equal(isGeneratedTutorialPath(`/treinamento/${ID}.mp4`), false);
});

test("the kind is read back from the extension", () => {
  assert.equal(tutorialPathKind(`treinamento/${ID}.mp4`), "video");
  assert.equal(tutorialPathKind(`treinamento/${ID}.vtt`), "captions");
  assert.equal(tutorialPathKind(`treinamento/${ID}.txt`), null);
});

test("a stored URL must sit in the store's own tutorial folder", () => {
  assert.ok(isStoredTutorialUrl(`https://${HOST}/treinamento/${ID}.mp4`, HOST));
  assert.equal(
    isStoredTutorialUrl(`https://${HOST}/anexos/${ID}.mp4`, HOST),
    false,
  );
  assert.equal(
    isStoredTutorialUrl(
      `https://outro.example.test/treinamento/${ID}.mp4`,
      HOST,
    ),
    false,
  );
  assert.equal(
    isStoredTutorialUrl(`http://${HOST}/treinamento/${ID}.mp4`, HOST),
    false,
  );
  assert.equal(isStoredTutorialUrl("nem url", HOST), false);
});

test("without a store, only the local uploads path is a stored URL", () => {
  assert.ok(isStoredTutorialUrl(`/uploads/treinamento/${ID}.vtt`, undefined));
  assert.equal(
    isStoredTutorialUrl(`https://${HOST}/treinamento/${ID}.mp4`, undefined),
    false,
  );
});

test("type and size are checked per kind, against the caller's limit", () => {
  assert.equal(
    checkTutorialFile(
      { mimeType: "video/mp4", size: 10 },
      "video",
      MAX_VIDEO_BYTES_DIRECT,
    ),
    null,
  );
  assert.deepEqual(
    checkTutorialFile({ mimeType: "video/quicktime", size: 10 }, "video", 100),
    { kind: "type", mimeType: "video/quicktime" },
  );
  assert.deepEqual(
    checkTutorialFile({ mimeType: "video/mp4", size: 101 }, "video", 100),
    { kind: "size", limit: 100 },
  );
  assert.deepEqual(
    checkTutorialFile(
      { mimeType: "text/vtt", size: MAX_CAPTIONS_BYTES + 1 },
      "captions",
      MAX_CAPTIONS_BYTES,
    ),
    { kind: "size", limit: MAX_CAPTIONS_BYTES },
  );
});

const schema = tutorialFormSchema(["/admin/pedidos", "/admin/agenda"]);

test("a valid form comes out trimmed, with the empty route as null", () => {
  const parsed = schema.parse({
    title: "  Primeiros passos ",
    description: "",
    durationSeconds: 245,
    route: "",
    trail: true,
    courseId: "9b0e3f4a-1c2d-4e5f-8a7b-6c5d4e3f2a1b",
    kind: "lesson",
  });
  assert.deepEqual(parsed, {
    title: "Primeiros passos",
    description: "",
    durationSeconds: 245,
    route: null,
    trail: true,
    courseId: "9b0e3f4a-1c2d-4e5f-8a7b-6c5d4e3f2a1b",
    kind: "lesson",
  });
});

test("a route the panel does not have is refused", () => {
  const result = schema.safeParse({
    title: "Pedidos",
    description: "",
    durationSeconds: 60,
    route: "/admin/inexistente",
    trail: false,
    courseId: "9b0e3f4a-1c2d-4e5f-8a7b-6c5d4e3f2a1b",
    kind: "lesson",
  });
  assert.equal(result.success, false);
});

test("a duration that could not be read is refused", () => {
  for (const durationSeconds of [0, -1, 1.5, Number.NaN]) {
    const result = schema.safeParse({
      title: "Pedidos",
      description: "",
      durationSeconds,
      route: "/admin/pedidos",
      trail: false,
    });
    assert.equal(result.success, false, String(durationSeconds));
  }
});

test("a poster's path takes the extension of its own image type", () => {
  assert.equal(
    tutorialFilePath("poster", ID, "image/jpeg"),
    `treinamento/${ID}.jpg`,
  );
  assert.equal(
    tutorialFilePath("poster", ID, "image/png"),
    `treinamento/${ID}.png`,
  );
  assert.equal(
    tutorialFilePath("poster", ID, "image/webp"),
    `treinamento/${ID}.webp`,
  );
  // A type the kind does not take falls back to the kind's first.
  assert.equal(
    tutorialFilePath("poster", ID, "image/gif"),
    `treinamento/${ID}.jpg`,
  );
  assert.equal(
    tutorialFilePath("video", ID, "image/png"),
    `treinamento/${ID}.mp4`,
  );
});

test("a poster path reads back as a poster, with its one type", () => {
  assert.equal(tutorialPathKind(`treinamento/${ID}.webp`), "poster");
  assert.equal(tutorialPathMimeType(`treinamento/${ID}.jpg`), "image/jpeg");
  assert.equal(tutorialPathMimeType(`treinamento/${ID}.png`), "image/png");
  assert.equal(tutorialPathMimeType(`treinamento/${ID}.mp4`), "video/mp4");
  assert.equal(tutorialPathMimeType(`treinamento/${ID}.gif`), null);
  assert.equal(isGeneratedTutorialPath(`treinamento/${ID}.gif`), false);
  assert.equal(isGeneratedTutorialPath(`treinamento/${ID}.jpeg`), false);
});

test("a stored poster URL is trusted like the video's", () => {
  assert.ok(isStoredTutorialUrl(`https://${HOST}/treinamento/${ID}.png`, HOST));
  assert.ok(isStoredTutorialUrl(`/uploads/treinamento/${ID}.webp`, undefined));
  assert.equal(
    isStoredTutorialUrl(`/uploads/treinamento/${ID}.gif`, undefined),
    false,
  );
});

test("the poster takes three image types, up to its own limit", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(
      checkTutorialFile({ mimeType, size: 10 }, "poster", MAX_POSTER_BYTES),
      null,
    );
  }
  assert.deepEqual(
    checkTutorialFile(
      { mimeType: "image/gif", size: 10 },
      "poster",
      MAX_POSTER_BYTES,
    ),
    { kind: "type", mimeType: "image/gif" },
  );
  assert.deepEqual(
    checkTutorialFile(
      { mimeType: "image/png", size: 5 * 1024 * 1024 },
      "poster",
      MAX_DIRECT_BYTES.poster,
    ),
    { kind: "size", limit: MAX_POSTER_BYTES },
  );
});

test("the course's support PDF is its own kind, up to 20 MB", () => {
  assert.equal(
    tutorialFilePath("material", ID, "application/pdf"),
    `treinamento/${ID}.pdf`,
  );
  assert.equal(tutorialPathKind(`treinamento/${ID}.pdf`), "material");
  assert.equal(
    tutorialPathMimeType(`treinamento/${ID}.pdf`),
    "application/pdf",
  );
  assert.equal(MAX_DIRECT_BYTES.material, 20 * 1024 * 1024);
  assert.deepEqual(
    checkTutorialFile(
      { mimeType: "application/msword", size: 10 },
      "material",
      MAX_DIRECT_BYTES.material,
    ),
    { kind: "type", mimeType: "application/msword" },
  );
});

test("a course address is lower case, digits and hyphens, never 'gerenciar'", () => {
  const ok = { title: "LGPD no cartório", description: "", sequential: true };
  assert.equal(
    courseFormSchema.safeParse({ ...ok, slug: "lgpd-no-cartorio" }).success,
    true,
  );
  for (const slug of ["gerenciar", "LGPD", "lgpd no cartorio", "-lgpd", "a"]) {
    assert.equal(
      courseFormSchema.safeParse({ ...ok, slug }).success,
      false,
      slug,
    );
  }
});

test("a description takes up to 2000 characters", () => {
  const base = {
    title: "Aula",
    durationSeconds: 60,
    route: "",
    trail: false,
    courseId: "9b0e3f4a-1c2d-4e5f-8a7b-6c5d4e3f2a1b",
    kind: "lesson",
  };
  assert.equal(MAX_TUTORIAL_DESCRIPTION, 2000);
  assert.equal(
    schema.safeParse({ ...base, description: "a".repeat(2000) }).success,
    true,
  );
  assert.equal(
    schema.safeParse({ ...base, description: "a".repeat(2001) }).success,
    false,
  );
});
