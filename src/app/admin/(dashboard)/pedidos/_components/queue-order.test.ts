import assert from "node:assert/strict";
import { test } from "node:test";
import { SERVICE_REQUEST_STATUSES } from "../../../../../core/request/kinds.ts";
import {
  compareQueueRows,
  QUEUE_GROUPS,
  type QueueRowOrder,
  queueGroupOf,
} from "./queue-order.ts";

const day = (n: number) => new Date(2026, 8, n);

test("closed statuses land in the last band whatever their tone", () => {
  assert.equal(queueGroupOf("rejected"), "closed");
  assert.equal(queueGroupOf("done"), "closed");
  assert.equal(queueGroupOf("with-requirement"), "blocked");
  assert.equal(queueGroupOf("ready-for-pickup"), "delivered");
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.ok(QUEUE_GROUPS.some((g) => g.id === queueGroupOf(status)));
  }
});

test("bands first, then the latest term, then arrival order", () => {
  const rows: QueueRowOrder[] = [
    { group: "closed", urgency: { kind: "closed" }, createdAt: day(1) },
    { group: "closed", urgency: { kind: "closed" }, createdAt: day(9) },
    { group: "working", urgency: { kind: "running" }, createdAt: day(5) },
    { group: "working", urgency: { kind: "running" }, createdAt: day(2) },
    {
      group: "waiting",
      urgency: { kind: "due-soon", daysLeft: 1 },
      createdAt: day(8),
    },
    {
      group: "waiting",
      urgency: { kind: "overdue", daysLate: 3 },
      createdAt: day(7),
    },
    {
      group: "blocked",
      urgency: { kind: "overdue", daysLate: 7 },
      createdAt: day(6),
    },
  ];
  const sorted = [...rows].sort(compareQueueRows);
  assert.deepEqual(
    sorted.map((r) => `${r.group}:${r.createdAt.getDate()}`),
    [
      "blocked:6",
      "waiting:7",
      "waiting:8",
      "working:2",
      "working:5",
      "closed:9",
      "closed:1",
    ],
  );
});
