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
  assert.equal(queueGroupOf("with-requirement"), "blocked");
  assert.equal(queueGroupOf("ready-for-pickup"), "delivered");
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.ok(QUEUE_GROUPS.some((g) => g.id === queueGroupOf(status)));
  }
});

test("bands first, then the latest term, then arrival order", () => {
  const rows: QueueRowOrder[] = [
    closed("rejected", 4),
    closed("done", 1),
    closed("rejected", 9),
    closed("done", 3),
    {
      group: "working",
      status: "in-review",
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
      status: "with-requirement",
      urgency: { kind: "overdue", daysLate: 7 },
      createdAt: day(6),
    },
  ];
  const sorted = [...rows].sort(compareQueueRows);
  assert.deepEqual(
    sorted.map((r) => `${r.status}:${r.createdAt.getDate()}`),
    [
      "with-requirement:6",
      "new:7",
      "new:8",
      "paid:2",
      "in-review:5",
      // Closed: concluídos together, then indeferidos, newest first in each.
      "done:3",
      "done:1",
      "rejected:9",
      "rejected:4",
    ],
  );
});
