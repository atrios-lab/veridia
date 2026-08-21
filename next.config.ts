import type { NextConfig } from "next";

// Content-Security-Policy is not here: it needs a fresh nonce per request so
// Next's own hydration payload can carry one, and a static header from this
// file cannot do that. It is built and set in src/middleware.ts. It must
// stay out of this list — a second, nonce-less CSP header from here would
// combine with the nonced one from the middleware, and a browser presented
// with two Content-Security-Policy headers enforces both: the nonce-less
// script-src from here would still block every hydration script the nonced
// one was written to allow.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Only development posts attachments through a server action: a deploy
    // with Blob configured uploads them straight from the browser, because a
    // platform function's request body is capped around 4.5 MB no matter what
    // this number says — which is why a citizen's photograph never arrived.
    // 110mb covers the local maximum (5 files of 20 MB, see
    // src/core/request/attachment.ts) plus multipart overhead; each file's own
    // size and count are still enforced server side.
    serverActions: { bodySizeLimit: "110mb" },
  },
  // pdfkit reads its standard font metrics from files at runtime, which a
  // bundler rewrites into paths that no longer exist. Left external, it loads
  // them the way it expects to.
  serverExternalPackages: ["pdfkit"],
  // Brand images (logotype, hero) publish to Vercel Blob when
  // BLOB_READ_WRITE_TOKEN is set (see src/lib/uploads.ts). next/image needs
  // that host allow-listed by exact hostname, never a wildcard pattern — the
  // same host also has to be added to img-src in src/middleware.ts.
  images: {
    remotePatterns: process.env.BLOB_PUBLIC_HOST
      ? [{ protocol: "https", hostname: process.env.BLOB_PUBLIC_HOST }]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
