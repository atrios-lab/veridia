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
const closed = (status: QueueRowOrder["status"], n: number): QueueRowOrder => ({
  group: "closed",
  status,
  urgency: { kind: "closed" },
  createdAt: day(n),
});

test("closed statuses land in the last band whatever their tone", () => {
  assert.equal(queueGroupOf("rejected"), "closed");
  assert.equal(queueGroupOf("done"), "closed");
  assert.equal(queueGroupOf("awaiting-compliance"), "blocked");
  assert.equal(queueGroupOf("ready-for-pickup"), "delivered");
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.ok(QUEUE_GROUPS.some((g) => g.id === queueGroupOf(status)));
  }
});

test("paid sits in Aguardando, not Em andamento, despite its green badge", () => {
  assert.equal(queueGroupOf("paid"), "waiting");
  assert.equal(queueGroupOf("new"), "waiting");
  assert.equal(queueGroupOf("processing"), "working");
});

test("bands first, then the latest term, then arrival order", () => {
  const rows: QueueRowOrder[] = [
    closed("rejected", 4),
    closed("done", 1),
    closed("rejected", 9),
    closed("done", 3),
    {
      group: "working",
      status: "processing",
      urgency: { kind: "running" },
      createdAt: day(5),
    },
    {
      group: "working",
      status: "paid",
      urgency: { kind: "running" },
      createdAt: day(2),
    },
    {
      group: "waiting",
      status: "new",
      urgency: { kind: "due-soon", daysLeft: 1 },
      createdAt: day(8),
    },
    {
      group: "waiting",
      status: "new",
      urgency: { kind: "overdue", daysLate: 3 },
      createdAt: day(7),
    },
    {
      group: "blocked",
      status: "awaiting-compliance",
      urgency: { kind: "overdue", daysLate: 7 },
      createdAt: day(6),
    },
  ];
  const sorted = [...rows].sort(compareQueueRows);
  assert.deepEqual(
    sorted.map((r) => `${r.status}:${r.createdAt.getDate()}`),
    [
      "awaiting-compliance:6",
      "new:7",
      "new:8",
      "paid:2",
      "processing:5",
      // Closed: concluídos together, then indeferidos, newest first in each.
      "done:3",
      "done:1",
      "rejected:9",
      "rejected:4",
    ],
  );
});

test("paid rows sort inside Aguardando by urgency, same as any other status there", () => {
  const rows: QueueRowOrder[] = [
    {
      group: "waiting",
      status: "new",
      urgency: { kind: "running" },
      createdAt: day(3),
    },
    {
      group: "waiting",
      status: "paid",
      urgency: { kind: "overdue", daysLate: 2 },
      createdAt: day(1),
    },
    {
      group: "working",
      status: "processing",
      urgency: { kind: "running" },
      createdAt: day(4),
    },
  ];
  assert.deepEqual(
    [...rows].sort(compareQueueRows).map((r) => `${r.status}:${r.group}`),
    ["paid:waiting", "new:waiting", "processing:working"],
  );
});

test("paused rows sit between the urgent and the quiet, longest wait first", () => {
  const row = (
    status: QueueRowOrder["status"],
    urgency: QueueRowOrder["urgency"],
    n: number,
  ): QueueRowOrder => ({
    group: "blocked",
    status,
    urgency,
    createdAt: day(n),
  });
  const rows: QueueRowOrder[] = [
    row("awaiting-compliance", { kind: "running" }, 1),
    row("awaiting-compliance", { kind: "paused", waitingDays: 2 }, 2),
    row("awaiting-compliance", { kind: "overdue", daysLate: 1 }, 3),
    row("awaiting-compliance", { kind: "paused", waitingDays: 8 }, 4),
    row("awaiting-compliance", { kind: "due-soon", daysLeft: 2 }, 5),
  ];
  assert.deepEqual(
    [...rows].sort(compareQueueRows).map((r) => r.createdAt.getDate()),
    [3, 5, 4, 2, 1],
  );
});
