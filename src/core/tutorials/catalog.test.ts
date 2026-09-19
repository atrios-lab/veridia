import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_NAV } from "@/app/admin/_components/nav.ts";
import { TUTORIALS } from "./catalog.ts";
import { mediaHosts } from "./progress.ts";

// What keeps every entry of the catalog honest, from the first video on.
// Each assertion holds vacuously while the catalog is empty, and starts
// meaning something the moment an entry lands.

test("ids are unique: the progress table keys on them", () => {
  const ids = TUTORIALS.map((t) => t.id);
  assert.deepEqual(ids, [...new Set(ids)]);
});

test("ids are slugs, never renamed into something the table cannot hold", () => {
  for (const { id } of TUTORIALS) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("every route is a screen the panel has", () => {
  const routes = new Set(
    ADMIN_NAV.filter((item) => !item.external).map((item) => item.href),
  );
  for (const { id, route } of TUTORIALS) {
    if (route === null) continue;
    assert.ok(
      routes.has(route) ||
        [...routes].some((known) => route.startsWith(`${known}/`)),
      `${id}: route ${route} is not a panel screen`,
    );
  }
});

test("media URLs are https and their hosts reach media-src", () => {
  const hosts = new Set(mediaHosts(TUTORIALS));
  for (const { id, videoUrl, captionsUrl } of TUTORIALS) {
    for (const url of [videoUrl, captionsUrl]) {
      const parsed = new URL(url);
      assert.equal(parsed.protocol, "https:", `${id}: ${url}`);
      assert.ok(hosts.has(parsed.host), `${id}: ${url}`);
    }
    assert.match(videoUrl, /\.mp4$/, `${id}: video must be an MP4`);
    assert.match(captionsUrl, /\.vtt$/, `${id}: captions must be WebVTT`);
  }
});

test("durations are positive and titles are not blank", () => {
  for (const { id, durationSeconds, title } of TUTORIALS) {
    assert.ok(durationSeconds > 0, id);
    assert.ok(title.trim().length > 0, id);
  }
});
