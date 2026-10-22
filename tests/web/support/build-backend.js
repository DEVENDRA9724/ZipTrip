// Compiles apps/backend for the browser tests. The incremental build cache goes to the OS temp folder so the tracked
// apps/backend/tsconfig.build.tsbuildinfo is not rewritten by test runs.
'use strict';
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const path = require('node:path');

const backend = path.resolve(__dirname, '../../../apps/backend');
const tsc = require.resolve('typescript/bin/tsc', { paths: [backend] });
const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json', '--tsBuildInfoFile', path.join(tmpdir(), 'safar-playwright-backend.tsbuildinfo')], { cwd: backend, stdio: 'inherit' });
process.exit(result.status ?? 1);
