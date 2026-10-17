// Checks bun.lock the way a supply-chain reviewer would: every package must come from the npm
// registry (no git, tarball URL or local path sources), carry a sha512 integrity hash, and be the
// package its name says, apart from the aliases listed below. Run in CI by the Security workflow.
import { readFileSync } from 'node:fs';

// Deliberate aliases: Vite+ ships its own build of Vite under the name vite.
const aliases = { vite: '@voidzero-dev/vite-plus-core' };

// bun.lock is JSON with trailing commas.
const lock = JSON.parse(readFileSync('bun.lock', 'utf8').replace(/,(\s*[}\]])/g, '$1'));
const problems = [];

for (const [key, entry] of Object.entries(lock.packages)) {
    const [spec, registry, , integrity] = entry;
    const at = spec.lastIndexOf('@');
    const name = spec.slice(0, at);
    const version = spec.slice(at + 1);
    // Nested copies are keyed "parent/child" (scoped names keep their own slash); the last name
    // in the key is the one the package is installed under.
    const expected = key.match(/(?:@[^/]+\/)?[^/@][^/]*$/)[0];

    if (registry !== '') problems.push(`${key}: comes from ${registry}, not the npm registry`);
    if (!/^\d+\.\d+\.\d+/.test(version)) problems.push(`${key}: ${spec} is not a registry version`);
    if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) problems.push(`${key}: no sha512 integrity hash`);
    if (name !== expected && aliases[expected] !== name) problems.push(`${key}: installs ${name} under another name`);
}

if (problems.length) {
    console.error(`bun.lock has ${problems.length} problem(s):\n${problems.join('\n')}`);
    process.exit(1);
}
console.log(`bun.lock: ${Object.keys(lock.packages).length} packages, all from the npm registry with integrity hashes`);
