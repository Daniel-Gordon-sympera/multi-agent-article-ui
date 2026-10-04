// Regenerates the OpenAPI TypeScript types for every API document that exists under docs/api.
// `docs/api/openapi-bff.json` is produced by the BFF (`uv run python -m scout_bff.openapi`) and
// may be missing in a fresh checkout; the script then generates only the pipeline types.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const documents = [
  { input: "../docs/api/openapi-pipeline.json", output: "src/api/pipeline.gen.ts" },
  { input: "../docs/api/openapi-bff.json", output: "src/api/bff.gen.ts" },
];

let failed = false;
for (const { input, output } of documents) {
  const absoluteInput = path.resolve(webRoot, input);
  if (!existsSync(absoluteInput)) {
    console.log(`gen:api  skip ${input} (not present)`);
    continue;
  }
  const result = spawnSync(
    "pnpm",
    ["exec", "openapi-typescript", absoluteInput, "-o", output, "--alphabetize"],
    { cwd: webRoot, stdio: "inherit" },
  );
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
