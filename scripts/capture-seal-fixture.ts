// Captures a fresh fixture of the TJRN seal lookup (SIEX), for when the TJ
// changes the page and the parser stops recognising it.
//
//   pnpm capture:seal
//
// The captcha is shown to you and answered by you: this tool automates the
// two requests around it, never the challenge itself. You also need a real
// seal code: one printed on a document the office issued.
//
// Save what it writes into src/lib/fixtures/ and anonymise it first: the
// "Objeto" line carries the name and CPF of whoever presented the act, and a
// fixture lives in git forever.

import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  fetchCaptcha,
  fetchLookupHtml,
  openSession,
} from "../src/lib/tj-seal.ts";

const ask = createInterface({ input: process.stdin, output: process.stdout });

const session = await openSession();
if (!session) throw new Error("O TJ não abriu sessão. Tente de novo.");

const captcha = await fetchCaptcha(session);
if (!captcha) throw new Error("O TJ não devolveu a imagem do captcha.");

const imagePath = join(tmpdir(), `selo-captcha-${Date.now()}.png`);
await writeFile(imagePath, Buffer.from(captcha.body));
console.log(`\nAbra a imagem e leia o código: ${imagePath}\n`);

const answer = (await ask.question("Texto da imagem: ")).trim();
const code = (await ask.question("Código do selo: ")).trim();
ask.close();

const html = await fetchLookupHtml(session, code, answer);
if (html === undefined) throw new Error("O TJ não respondeu à consulta.");

const outputPath = join(process.cwd(), `seal-response-${Date.now()}.html`);
// Written back in the encoding it arrived in, so the fixture exercises the
// same decoding the application does.
await writeFile(outputPath, Buffer.from(html, "latin1"));
console.log(`\nResposta gravada em ${outputPath}`);
console.log("Anonimize a linha 'Objeto' antes de versionar.");
