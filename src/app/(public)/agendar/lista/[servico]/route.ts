import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { resolveService } from "@/core/scheduling/services.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { getAgendaConfig } from "@/lib/appointments.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The office's own list of what to bring for a service, the PDF or photo it
 * attached in the panel. Public, like the list on the screen: it is what
 * anyone booking that service is told to bring. Looked up through the agenda
 * configuration, never by path, so only a file the office attached to a
 * service that still exists answers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ servico: string }> },
): Promise<Response> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "agendamento")) {
    return new Response("Não encontrado", { status: 404 });
  }
  const serviceId = decodeURIComponent((await params).servico);
  const config = await getAgendaConfig(tenant.slug);
  const service = resolveService(config, serviceId);
  const file = config.checklists[serviceId]?.file;
  if (!service || !file) {
    return new Response("Não encontrado", { status: 404 });
  }

  // In the deploy the file is a public blob: send the browser there, as the
  // publications do, instead of piping a scanned PDF through this function.
  if (file.path.startsWith("http")) {
    return new Response(null, {
      status: 307,
      headers: { Location: file.path, "Cache-Control": "no-store" },
    });
  }

  // Development: the file is on disk.
  const bytes = await readFile(file.path);
  const extension = extname(file.storedName);
  const name = `o-que-levar-${service.label}`
    .replace(/[\\/:*?"<>|]/g, "-")
    .slice(0, 120);
  const ascii = name.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${ascii || "o-que-levar"}${extension}"; filename*=UTF-8''${encodeURIComponent(name + extension)}`,
      "Cache-Control": "no-store",
    },
  });
}
