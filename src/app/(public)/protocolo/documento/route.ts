import { readFile } from "node:fs/promises";
import { findByProtocolWithKey, getAttachment } from "@/lib/service-request.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * POST, not GET: same reasoning as the other protocol downloads, the
 * access key would otherwise sit in the address bar and in every log on
 * the way.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  const protocolNumber = String(form.get("protocolNumber") ?? "");
  const accessKey = String(form.get("accessKey") ?? "");
  const attachmentId = String(form.get("attachmentId") ?? "");

  // One answer for "no such protocol", "wrong key" and "not this request's
  // file": nothing here should tell a guesser which part was wrong.
  const stored = await findByProtocolWithKey(
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  if (!stored) return new Response("Não encontrado", { status: 404 });

  // The office's own deliveries and the citizen's own uploads both live
  // here: ownership is already proven by the protocol + key above, so kind
  // isn't a security boundary for this route.
  const attachment = await getAttachment(tenant.slug, stored.id, attachmentId);
  if (!attachment) return new Response("Não encontrado", { status: 404 });

  const bytes = attachment.path.startsWith("http")
    ? Buffer.from(await (await fetch(attachment.path)).arrayBuffer())
    : await readFile(attachment.path);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="documento-${stored.protocolNumber}${extensionOf(attachment.mimeType)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
};

function extensionOf(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? "";
}
