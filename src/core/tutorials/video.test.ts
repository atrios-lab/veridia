import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkTutorialFile,
  isGeneratedTutorialPath,
  isStoredTutorialUrl,
  MAX_CAPTIONS_BYTES,
  MAX_VIDEO_BYTES_DIRECT,
  tutorialFilePath,
  tutorialFormSchema,
  tutorialPathKind,
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
  });
  assert.deepEqual(parsed, {
    title: "Primeiros passos",
    description: "",
    durationSeconds: 245,
    route: null,
    trail: true,
  });
});

test("a route the panel does not have is refused", () => {
  const result = schema.safeParse({
    title: "Pedidos",
    description: "",
    durationSeconds: 60,
    route: "/admin/inexistente",
    trail: false,
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
