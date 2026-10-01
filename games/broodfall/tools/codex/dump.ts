/** Prints the Limb Codex's data as JSON (src/ui/codexData.ts): `npx vite-node tools/codex/dump.ts > out.json`. */
import { codexEntries } from '../../src/ui/codexData';
process.stdout.write(JSON.stringify(codexEntries(), null, 1));
