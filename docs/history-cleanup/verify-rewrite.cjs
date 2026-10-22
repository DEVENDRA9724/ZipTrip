#!/usr/bin/env node
// Read-only verification of a rewritten mirror before it is published (docs/history-cleanup/EXECUTION_CHECKLIST.md).
// It never fetches, pushes, writes refs or prints file contents; it only runs read-only git commands and the
// repository's secret scanner. It fails closed: exit code 0 only when every gate passed; any error, missing input or
// unexpected state is a FAIL (exit 1). Usage errors exit 2.
//
// Usage: node docs/history-cleanup/verify-rewrite.cjs --old <pre-rewrite mirror> --new <rewritten mirror>
//        [--paths docs/history-cleanup/paths-to-remove.txt]
// Tests: apps/backend/src/common/history-cleanup-verifier.spec.ts (synthetic clean and unsafe repositories).
'use strict';
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const oldRepo = arg('--old') && resolve(arg('--old'));
const newRepo = arg('--new') && resolve(arg('--new'));
if (!oldRepo || !newRepo) { console.error('Usage: verify-rewrite.cjs --old <pre-rewrite mirror> --new <rewritten mirror> [--paths <file>]'); process.exit(2); }
const pathsFile = resolve(arg('--paths', join(__dirname, 'paths-to-remove.txt')));
const scanner = resolve(__dirname, '../../apps/backend/scripts/scan-git-history.cjs');
const git = (repo, args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const results = [];
const gate = (name, ok, detail = '') => results.push([ok ? 'PASS' : 'FAIL', name, detail]);
// Only branches and tags are published. GitHub's read-only refs/pull/* may appear in a mirror clone and are ignored
// (never pushed). Any other namespace (refs/replace from filter-repo, refs/notes, refs/remotes, refs/stash, …) fails.
const PUBLISHED = /^refs\/(heads|tags)\//;
const IGNORED = /^refs\/pull\//;

function verify() {
  // 0. Inputs.
  gate('old and new repositories exist and differ', existsSync(oldRepo) && existsSync(newRepo) && oldRepo !== newRepo, '');
  const removed = existsSync(pathsFile) ? readFileSync(pathsFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  gate('removal path list is present and non-empty', removed.length > 0, `${removed.length} path(s)`);
  if (results.some((r) => r[0] === 'FAIL')) return;

  // 1. Refs: the same published names, and nothing outside the published or ignored namespaces.
  const allRefs = (repo) => git(repo, ['for-each-ref', '--format=%(refname)']).split('\n').filter(Boolean).sort();
  const oldAll = allRefs(oldRepo), newAll = allRefs(newRepo);
  const oldRefs = oldAll.filter((r) => PUBLISHED.test(r)), newRefs = newAll.filter((r) => PUBLISHED.test(r));
  gate('same branch and tag names', oldRefs.length > 0 && JSON.stringify(oldRefs) === JSON.stringify(newRefs), `old ${oldRefs.length}, new ${newRefs.length}`);
  const unexpected = newAll.filter((r) => !PUBLISHED.test(r) && !IGNORED.test(r));
  gate('no unexpected refs in the rewritten mirror', unexpected.length === 0, unexpected.length ? `found: ${unexpected.slice(0, 5).join(', ')}` : '');

  // 2. No removed path is reachable from any ref of the rewritten mirror.
  const reachable = removed.filter((p) => git(newRepo, ['log', '--all', '--format=%h', '--', p]).length > 0);
  gate('removed paths absent from all history', reachable.length === 0, reachable.length ? `still present: ${reachable.join(', ')}` : `${removed.length} paths checked`);

  // 3. For every branch and tag, the tip tree equals the old tip tree minus the removed paths (compared by blob id).
  const tree = (repo, ref) => new Map(git(repo, ['ls-tree', '-r', ref]).split('\n').filter(Boolean).map((l) => { const [meta, path] = l.split('\t'); return [path, meta.split(' ')[2]]; }));
  for (const ref of oldRefs.filter((r) => newRefs.includes(r))) {
    const before = tree(oldRepo, ref), after = tree(newRepo, ref);
    for (const p of removed) before.delete(p);
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter((p) => before.get(p) !== after.get(p));
    gate(`tip tree of ${ref} unchanged apart from removed paths`, changed.length === 0, changed.length ? `${changed.length} differing path(s), e.g. ${changed.slice(0, 3).join(', ')}` : '');
  }

  // 4. Same number of commits on each branch (an initial commit containing only removed files would be pruned, so a
  //    difference is reported for review rather than silently accepted).
  for (const ref of oldRefs.filter((r) => r.startsWith('refs/heads/') && newRefs.includes(r))) {
    const a = Number(git(oldRepo, ['rev-list', '--count', ref])), b = Number(git(newRepo, ['rev-list', '--count', ref]));
    gate(`commit count of ${ref}`, a === b, `old ${a}, new ${b}`);
  }

  // 5. The repository's credential scanner (same detectors and exposed fingerprints) finds nothing anywhere in the
  //    rewritten mirror. A scanner that did not run, or reported anything, is a FAIL.
  const scan = spawnSync(process.execPath, [scanner, '--repo', newRepo], { encoding: 'utf8' });
  const lines = (scan.stdout || '').split('\n');
  const summary = lines.filter((l) => /^(Scanned|FOUND|No findings)/.test(l)).map((l) => l.replace(/  on: .*$/, '')).join(' | ');
  gate('credential scan of the rewritten mirror is clean', scan.status === 0 && lines.some((l) => l.startsWith('No findings in history')), summary || `scanner did not run (status ${scan.status})`);
}

try {
  verify();
} catch (error) {
  // Report the failing git command only; never echo file contents.
  gate('verification completed without errors', false, String(error.message || error).split('\n')[0].slice(0, 200));
}
for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? ` (${detail})` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
const ok = failed === 0 && results.length > 0;
console.log(`\n${results.length - failed} passed, ${failed} failed. ${ok ? 'Gates passed; continue with the checklist.' : 'Do NOT publish.'}`);
process.exit(ok ? 0 : 1);
