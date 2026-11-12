// Loaded by `npm test` (node --import) before every test file. Registers
// resolve hooks so tests can import app modules (server actions included)
// without Next.js or a database. See ./hooks.mjs.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
