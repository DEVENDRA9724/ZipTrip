// Read-only scan of every file version reachable from any local ref (branches, tags, remote-tracking refs) with the same
// detectors as the working-tree secret test. Prints commit, path and rule only, never the matched value. It does not
// modify the repository or contact the remote.
// Usage: node scripts/scan-git-history.cjs [--repo <path>]   (or npm run secrets:scan-history)
//   --repo scans another local repository, including a bare mirror (for example a rewritten mirror before publishing,
//   docs/GIT_HISTORY_CLEANUP_PLAN.md). Without it, this repository is scanned.
'use strict';
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { secretFindings, isLocalEnv } = require('./secret-detectors.cjs');

const repoArg = process.argv.indexOf('--repo');
const repo = repoArg > 0 ? resolve(process.argv[repoArg + 1]) : execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: resolve(__dirname, '..'), encoding: 'utf8' }).trim();
const git = (args, input) => execFileSync('git', args, { cwd: repo, input, maxBuffer: 1 << 30 });
const BINARY = /\.(png|jpe?g|webp|gif|ico|svg|docx|pdf|db|zip|tsbuildinfo|woff2?)$/i;
const MAX_BYTES = 2 * 1024 * 1024;

// Every (blob, path) pair in history; a blob is scanned once even if it appears under several commits.
const objects = git(['rev-list', '--objects', '--all']).toString('utf8').split('\n').filter((line) => line.includes(' '));
const blobs = new Map();
for (const line of objects) {
  const [sha, ...rest] = line.split(' ');
  const path = rest.join(' ');
  if (!BINARY.test(path) && !blobs.has(sha)) blobs.set(sha, path);
}
const types = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], [...blobs.keys()].join('\n') + '\n').toString('utf8').trim().split('\n');
const findings = [];
for (const entry of types) {
  const [sha, type, size] = entry.split(' ');
  if (type !== 'blob' || Number(size) > MAX_BYTES) continue;
  const path = blobs.get(sha);
  const rules = secretFindings(git(['cat-file', 'blob', sha]).toString('utf8'), isLocalEnv(path));
  if (!rules.length) continue;
  // The commits that introduced this exact content (short hashes only).
  const commits = git(['log', '--all', '--format=%h', `--find-object=${sha}`]).toString('utf8').trim().split('\n').filter(Boolean);
  const onRefs = git(['branch', '-a', '--contains', commits[commits.length - 1] || 'HEAD', '--format=%(refname:short)']).toString('utf8').trim().split('\n').filter(Boolean);
  findings.push({ path, rules: rules.join(', '), commits: commits.join(' '), refs: onRefs.join(' ') });
}
const refsScanned = git(['for-each-ref', '--format=%(refname:short)']).toString('utf8').trim().split('\n').length;
console.log(`Scanned ${blobs.size} file versions across ${refsScanned} refs.`);
for (const f of findings) console.log(`FOUND  ${f.path}  [${f.rules}]  commits: ${f.commits}  on: ${f.refs}`);
console.log(findings.length ? `\n${findings.length} file version(s) in history contain credential findings. History rewriting requires separate approval (docs/GIT_HISTORY_CLEANUP_PLAN.md).` : '\nNo findings in history.');
process.exit(findings.length ? 1 : 0);
