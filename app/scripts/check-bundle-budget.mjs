/**
 * Orçamento do bundle do cliente.
 * Somamos o gzip de todos os .js em dist/public/assets e falhamos se passar
 * do teto. Rode depois de `npm run build:client` (o CI faz isso).
 * Para acompanhar a evolução: rode localmente e compare com o valor impresso.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const ASSETS_DIR = join(import.meta.dirname, "..", "dist", "public", "assets");
// Teto atual: ~1065 KB medidos + margem para features (revise se estourar).
const TOTAL_BUDGET_KB = 1250;

if (!existsSync(ASSETS_DIR)) {
  console.error(`Diretório não encontrado: ${ASSETS_DIR}. Rode build:client antes.`);
  process.exit(1);
}

const files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error("Nenhum .js em dist/public/assets. Build incompleto?");
  process.exit(1);
}

let total = 0;
const ranking = [];
for (const file of files) {
  const bytes = gzipSync(readFileSync(join(ASSETS_DIR, file))).length;
  total += bytes;
  ranking.push({ file, kb: bytes / 1024 });
}
ranking.sort((a, b) => b.kb - a.kb);

const totalKb = total / 1024;
console.log(`JS total (gzip): ${totalKb.toFixed(1)} KB em ${files.length} arquivos (teto: ${TOTAL_BUDGET_KB} KB)`);
console.log("Maiores arquivos:");
for (const { file, kb } of ranking.slice(0, 8)) {
  console.log(`  ${kb.toFixed(1).padStart(7)} KB  ${file}`);
}

if (totalKb > TOTAL_BUDGET_KB) {
  console.error(
    `\nOrçamento estourado por ${(totalKb - TOTAL_BUDGET_KB).toFixed(1)} KB. ` +
      `Considere code-split (React.lazy) do que cresceu ou suba o teto em scripts/check-bundle-budget.mjs com justificativa.`
  );
  process.exit(1);
}
console.log("Orçamento OK.");
