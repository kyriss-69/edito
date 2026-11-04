// Re-télécharge les skills par réseau depuis leurs dépôts GitHub d'origine
// (liste dans brand/skills/sources.json), sans les modifier. `git diff brand/skills`
// montre ensuite ce qui a changé.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const folder = path.join(process.cwd(), "brand", "skills");
const { branch, repos } = JSON.parse(await readFile(path.join(folder, "sources.json"), "utf8"));

let changed = 0;
let failed = 0;
for (const { repo, files } of repos) {
  for (const { from, to } of files) {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${from}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`✗ ${repo}/${from} : ${res.status}`);
      failed++;
      continue;
    }
    const text = await res.text();
    const target = path.join(folder, to);
    const before = await readFile(target, "utf8").catch(() => null);
    if (before === text) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
    console.log(`↻ ${to}`);
    changed++;
  }
}
console.log(`${changed} fichier(s) mis à jour${failed ? `, ${failed} en échec` : ""}.`);
if (failed) process.exitCode = 1;
