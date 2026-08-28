// Varre as rotas públicas com o axe contra o servidor que já está rodando e
// falha se houver violação de severidade critical ou serious.
// Uso: pnpm check:a11y  (com `pnpm dev` no ar)
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
// localhost puro cai no tenant de fallback; cada host de cartório carrega um
// tema, e um valor que passa num tema reprova no outro — então a varredura
// cobre um tenant por tema. A11Y_BASE_URL restringe a um host só.
const hosts = process.env.A11Y_BASE_URL
  ? [process.env.A11Y_BASE_URL]
  : [
      "marinho", // verde-dourado
      "aurora", // marinho-bronze
      "santacruz", // vinho-perola
      "taipu", // grafite-cobre
      "bentofernandes", // oliva-terracota
    ].map((h) => `http://${h}.localhost:${PORT}`);

// ponytail: só as rotas públicas, que não pedem sessão. As telas de /admin
// entram aqui quando o loop precisar delas com login.
const routes = [
  "/",
  "/solicitar",
  "/agendar",
  "/protocolo",
  "/selo",
  "/ouvidoria",
  "/contato",
  "/centrais",
  "/editais",
  "/transparencia",
  "/lgpd",
  "/privacidade",
  "/admin/login",
];

// axe exige um contexto explícito, browser.newPage() direto não serve.
// reducedMotion: o aviso de cookies entra num fade de 0.4s a partir de
// opacity 0; quando o axe mede no meio do fade, o texto translúcido reprova
// contraste que a tela parada passa. Com motion-reduce a animação não roda
// e o axe sempre vê o estado final, que é o que se quer medir.
const browser = await chromium.launch();
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
let failed = 0;

for (const baseURL of hosts) {
  console.log(`\n== ${baseURL}`);
  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    if (blocking.length === 0) {
      console.log(`ok   ${route}`);
      continue;
    }
    failed += blocking.length;
    console.log(`FAIL ${route}`);
    for (const v of blocking) {
      const where = v.nodes.map((n) => n.target.join(" ")).join(", ");
      console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      console.log(`    ${where}`);
    }
  }
}

await browser.close();
if (failed > 0) {
  console.log(`\n${failed} violação(ões) critical/serious`);
  process.exit(1);
}
console.log("\nnenhuma violação critical/serious");
