// Build da Vercel: aplica as migrations pendentes e só então compila.
//
// Roda somente no deploy de produção. Preview usa banco próprio ou nenhum,
// e um preview que migra produção transforma um teste em incidente (ver
// docs/migrations.md). Fora da Vercel (CI, máquina local) este script é
// só `next build`.
//
// Migrar antes de compilar é o que garante que a versão publicada nunca
// consulta uma coluna que ainda não existe. Se a migration falhar, o build
// falha e a versão anterior continua no ar.
import { execSync, spawnSync } from "node:child_process";
import {
  MAX_BUILD_ATTEMPTS,
  RETRY_DELAY_SECONDS,
  shouldRetryBuild,
} from "./build-retry.ts";

const isProduction = process.env.VERCEL_ENV === "production";

if (isProduction && !process.env.DIRECT_URL) {
  throw new Error(
    "DIRECT_URL nao esta definida no ambiente de producao da Vercel. Sem ela as migrations nao rodam e o deploy sairia com o schema desatualizado.",
  );
}

const run = (command) => execSync(command, { stdio: "inherit" });

if (isProduction) {
  console.log("[vercel-build] producao: aplicando migrations pendentes");
  run("pnpm db:migrate");
} else {
  console.log(
    `[vercel-build] VERCEL_ENV=${process.env.VERCEL_ENV ?? "(fora da Vercel)"}: migrations nao rodam`,
  );
}

// The build is tried again only when Google Fonts did not answer (see
// build-retry.ts): the same commit then builds on the next try, and a
// deploy should not fail for a font server. Any other error stops here.
for (let attempt = 1; ; attempt++) {
  const result = spawnSync("pnpm", ["build"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["inherit", "pipe", "pipe"],
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status === 0) break;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!shouldRetryBuild(attempt, output)) {
    process.exit(result.status ?? 1);
  }
  console.log(
    `[vercel-build] as fontes do Google nao responderam (tentativa ${attempt} de ${MAX_BUILD_ATTEMPTS}); tentando de novo em ${RETRY_DELAY_SECONDS} s`,
  );
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    RETRY_DELAY_SECONDS * 1000,
  );
}
