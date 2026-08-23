import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../db/migrations", import.meta.url));
const destination = fileURLToPath(
  new URL("../dist/migrations", import.meta.url)
);

await mkdir(fileURLToPath(new URL("../dist", import.meta.url)), {
  recursive: true,
});
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
