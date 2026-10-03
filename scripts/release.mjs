import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function nextVersion(base, messages) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(base);
  if (!match) throw new Error(`Invalid release version: ${base}`);
  const levels = { none: 0, skip: 0, patch: 1, fix: 1, minor: 2, feature: 2, major: 3, breaking: 3 };
  let level = 0;
  for (const message of messages) {
    for (const directive of message.matchAll(/\+semver:\s*(major|breaking|minor|feature|patch|fix|none|skip)\b/gi)) {
      level = Math.max(level, levels[directive[1].toLowerCase()]);
    }
  }
  if (!level) return null;
  let [, major, minor, patch] = match.map(Number);
  if (level === 3) { major++; minor = 0; patch = 0; }
  else if (level === 2) { minor++; patch = 0; }
  else patch++;
  return `v${major}.${minor}.${patch}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const base = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*');
  const messages = git('log', `${base}..HEAD`, '--format=%B%x00').split('\0');
  const tag = nextVersion(base, messages);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag ?? ''}\n`);
  console.log(tag ?? 'No release requested');
}
