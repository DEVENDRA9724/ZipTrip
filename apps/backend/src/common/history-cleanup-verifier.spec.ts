import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Tests for docs/history-cleanup/verify-rewrite.cjs, the read-only gate run before a history rewrite is published.
// Synthetic repositories are built from scratch (no history is rewritten). The fake credential is generated at
// runtime and is not a real key; the tests also assert it never appears in the verifier's output.
const verifier = resolve(
  process.cwd(),
  '../../docs/history-cleanup/verify-rewrite.cjs',
);

describe('History cleanup verifier (fails closed)', () => {
  let root: string;
  const fake = 'key_' + 'live_' + randomBytes(12).toString('hex');
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        '-c',
        'core.autocrlf=false',
        '-c',
        'init.defaultBranch=main',
        ...args,
      ],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

  // Builds a two-commit repository and returns the path of a bare clone (like a mirror).
  function repo(
    name: string,
    commits: Record<string, string>[],
    extra?: (dir: string) => void,
  ) {
    const dir = join(root, name);
    mkdirSync(dir);
    git(dir, 'init', '--quiet');
    commits.forEach((files, i) => {
      for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), content);
      }
      git(dir, 'add', '-A');
      git(dir, 'commit', '--quiet', '-m', `commit ${i + 1}`);
    });
    git(dir, 'tag', 'v1');
    extra?.(dir);
    git(root, 'clone', '--quiet', '--mirror', dir, name + '.git');
    return join(root, name + '.git');
  }
  const leaky: Record<string, string>[] = [
    {
      'a.js': 'export const a = 1;\n',
      'scripts/leak.js': `const k = '${fake}';\n`,
    },
    { 'a.js': 'export const a = 2;\n' },
  ];
  const clean: Record<string, string>[] = [
    { 'a.js': 'export const a = 1;\n' },
    { 'a.js': 'export const a = 2;\n' },
  ];
  const run = (
    oldRepo: string,
    newRepo: string,
    paths: string[] = ['scripts/leak.js'],
  ) => {
    const pathsFile = join(root, `paths-${randomBytes(4).toString('hex')}.txt`);
    writeFileSync(pathsFile, paths.join('\n'));
    const result = spawnSync(
      process.execPath,
      [verifier, '--old', oldRepo, '--new', newRepo, '--paths', pathsFile],
      { encoding: 'utf8' },
    );
    expect(result.stdout + result.stderr).not.toContain(fake);
    return { status: result.status, out: result.stdout };
  };
  const failed = (out: string, gate: string) =>
    out.split('\n').some((l) => l.startsWith('FAIL') && l.includes(gate));

  let oldRepo: string, cleanRepo: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'safar-verifier-'));
    oldRepo = repo('old', leaky);
    cleanRepo = repo('clean', clean);
  });
  afterAll(() => {
    if (root && root.startsWith(join(tmpdir(), 'safar-verifier-')))
      rmSync(root, { recursive: true, force: true });
  });

  it('passes a correctly cleaned history', () => {
    const { status, out } = run(oldRepo, cleanRepo);
    expect(status).toBe(0);
    expect(out).toContain('Gates passed');
    expect(out).not.toMatch(/^FAIL/m);
  });

  it('fails when the removed path and its secret are still in history', () => {
    const { status, out } = run(oldRepo, repo('uncleaned', leaky));
    expect(status).toBe(1);
    expect(failed(out, 'removed paths absent')).toBe(true);
    expect(failed(out, 'credential scan')).toBe(true);
    expect(out).toContain('Do NOT publish');
    // The same repository passed as both old and new is refused outright.
    expect(failed(run(oldRepo, oldRepo).out, 'differ')).toBe(true);
  });

  it('fails when a secret remains in a path that is not on the removal list', () => {
    const elsewhere = repo('elsewhere', [
      {
        'a.js': 'export const a = 1;\n',
        'config/keys.js': `module.exports = '${fake}';\n`,
      },
      { 'a.js': 'export const a = 2;\n' },
    ]);
    const { status, out } = run(oldRepo, elsewhere);
    expect(status).toBe(1);
    expect(failed(out, 'credential scan')).toBe(true);
  });

  it('fails on unexpected branches and on refs outside branches and tags (for example refs/replace)', () => {
    const extraBranch = repo('extra-branch', clean, (dir) =>
      git(dir, 'branch', 'leftover'),
    );
    expect(
      failed(run(oldRepo, extraBranch).out, 'same branch and tag names'),
    ).toBe(true);
    const replaceRef = repo('replace-ref', clean);
    git(
      replaceRef,
      'update-ref',
      'refs/replace/' + git(replaceRef, 'rev-parse', 'HEAD').trim(),
      git(replaceRef, 'rev-parse', 'HEAD~1').trim(),
    );
    const { status, out } = run(oldRepo, replaceRef);
    expect(status).toBe(1);
    expect(failed(out, 'no unexpected refs')).toBe(true);
  });

  it('fails when other content changed or commits were lost', () => {
    const changed = repo('changed', [
      { 'a.js': 'export const a = 1;\n' },
      { 'a.js': 'export const a = 3;\n' },
    ]);
    expect(
      failed(run(oldRepo, changed).out, 'tip tree of refs/heads/main'),
    ).toBe(true);
    const squashed = repo('squashed', [{ 'a.js': 'export const a = 2;\n' }]);
    expect(
      failed(run(oldRepo, squashed).out, 'commit count of refs/heads/main'),
    ).toBe(true);
  });

  it('fails closed on an empty removal list or a missing repository', () => {
    const empty = run(oldRepo, cleanRepo, []);
    expect(empty.status).toBe(1);
    expect(failed(empty.out, 'removal path list')).toBe(true);
    const missing = run(oldRepo, join(root, 'does-not-exist.git'));
    expect(missing.status).toBe(1);
    expect(missing.out).toContain('Do NOT publish');
  });
});
