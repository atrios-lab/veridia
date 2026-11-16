import { db } from "@/db/index.ts";
import { finishJobWith } from "@/lib/signing-stations.ts";
import { bodyOf, noStore, stationOf } from "../../_auth.ts";

export const runtime = "nodejs";

/** The station answers one signature: the signature, or why not. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const station = await stationOf(request);
  if (!station) return new Response(null, { status: 401, headers: noStore });
  const body = (await bodyOf(request, 20_000)) as
    | { assinatura?: unknown; erro?: unknown }
    | undefined;
  if (!body) return new Response(null, { status: 400, headers: noStore });
  const done = await finishJobWith(db, station, (await params).id, body);
  return new Response(null, { status: done ? 204 : 404, headers: noStore });
}
