import { timingSafeEqual } from "node:crypto";
import {
  CERTIFICATE_CHECK_ORIGINS,
  normalizeCertificateCode,
  publicCertificate,
} from "@/core/courses/certificate.ts";
import { certificateByCode } from "@/lib/certificates.ts";
import { isCertificateRateLimited } from "@/lib/rate-limit.ts";

/**
 * The certificate check, for the Átrios site (atrioss.com/certificado/<código>),
 * which renders the page: this answers the public view of one certificate
 * as JSON, the CPF masked, nothing else of the row.
 *
 * Two ways in. From a browser on the Átrios site: CORS lets that origin
 * read the answer, and the budget is per visitor address (30 lookups in 10
 * minutes). From the Átrios server: every call comes from one address, so
 * it sends `Authorization: Bearer <CERTIFICATE_API_TOKEN>` instead and is
 * not budgeted. A malformed code and one that does not exist get the same
 * 404, so the answer never says which.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
): Promise<Response> {
  const cors = corsHeaders(request.headers.get("origin"));
  if (!isTrustedServer(request.headers.get("authorization"))) {
    if (await isCertificateRateLimited(request.headers)) {
      return json(
        { valid: false, error: "Muitas consultas seguidas." },
        429,
        cors,
      );
    }
  }
  const { codigo } = await params;
  const code = normalizeCertificateCode(decodeURIComponent(codigo));
  const certificate = code ? await certificateByCode(code) : undefined;
  if (!certificate) return json({ valid: false }, 404, cors);
  return json(publicCertificate(certificate), 200, cors);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { vary: "Origin" };
  if (origin && CERTIFICATE_CHECK_ORIGINS.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET";
  }
  return headers;
}

function isTrustedServer(authorization: string | null): boolean {
  const token = process.env.CERTIFICATE_API_TOKEN;
  if (!token || !authorization?.startsWith("Bearer ")) return false;
  const given = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...headers,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
