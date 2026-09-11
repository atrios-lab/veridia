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
import { execSync } from "node:child_process";

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

run("pnpm build");
