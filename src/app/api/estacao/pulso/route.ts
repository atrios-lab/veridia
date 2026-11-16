import { db } from "@/db/index.ts";
import { pulseWith } from "@/lib/signing-stations.ts";
import { bodyOf, noStore, stationOf } from "../_auth.ts";

export const runtime = "nodejs";

/**
 * The station calls in (every few seconds): what is plugged in goes in,
 * the signatures asked of it come out.
 */
export async function POST(request: Request): Promise<Response> {
  const station = await stationOf(request);
  if (!station) return new Response(null, { status: 401, headers: noStore });
  const body = (await bodyOf(request, 400_000)) as
    | { versao?: unknown; certificados?: unknown }
    | undefined;
  if (!body) return new Response(null, { status: 400, headers: noStore });
  const tarefas = await pulseWith(db, station, {
    version: body.versao,
    certificates: body.certificados,
  });
  return Response.json({ tarefas }, { headers: noStore });
}
