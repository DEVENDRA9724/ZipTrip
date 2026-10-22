// Shared credential detectors for the repository secret test (src/common/repository-secrets.spec.ts) and the
// read-only Git history scan (scripts/scan-git-history.cjs). Findings name a rule only; matched values are never
// returned or printed.
'use strict';
const { createHash } = require('node:crypto');

const SANDBOX = [/\bkey_(live|test)_[A-Za-z0-9]{16,}/, /\bsecret_(live|test)_[A-Za-z0-9]{16,}/];
// A string literal passed as the secret argument of jwt.sign/verify (the form used by the leaked scripts).
const JWT_LITERAL = /\b(?:jwt|jsonwebtoken|jwtService)\s*\.\s*(?:sign|verify)(?:Async)?\(\s*[\s\S]{0,400}?,\s*(['"`])([^'"`\s]{16,})\1/;
// JWT secret assignments. Placeholders, templates and env lookups are allowed, and so are values generated at runtime.
const SECRET_KEY = '(?:JWT_SECRET|jwtSecret|jwt_secret|secretOrKey|secretOrPrivateKey)';
// .env style: a line starting with JWT_SECRET=<value>.
const JWT_ENV_LINE = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${SECRET_KEY}[ \\t]*=[ \\t]*([^\\s#'"\`]+)`, 'gm');
// Code style: jwtSecret: '<literal>'. Expressions (spaces, calls, concatenation) are not literals.
const JWT_CODE_LITERAL = new RegExp(`\\b${SECRET_KEY}\\b\\s*[:=]\\s*(['"\`])([^'"\`\\s()+]+)\\1`, 'g');
const PLACEHOLDER = /^(replace|change|your|example|placeholder|dummy|test|xxx|<|\$\{|process\.env)/i;

// SHA-256 fingerprints of credentials known to have been exposed in this repository's history: the JWT signing secret
// and the Sandbox live API key and secret. A match anywhere, including local .env files, means a leaked value is still
// in use and has not been rotated.
const EXPOSED_SECRET_SHA256 = new Set([
  '52f28145d75426c64bce980e903346ced2e7033229edbf69d226d70d5617332d', // JWT signing secret (96 hex chars)
  'ab6c632d8ee01b6f340fb681ce321addf29587c43bf145ede546d1b702dbd628', // Sandbox live API key
  'e8005940d6c3fe88fb64a9ecb288415ee1cfc60d26194b2a3539297809c2170c', // Sandbox live API secret
]);

function isLocalEnv(path) {
  const name = String(path).split(/[\\/]/).pop();
  return name.startsWith('.env') && name !== '.env.example';
}

// Tokens are split on any character outside the credential alphabet, including "=", so values in KEY=value lines are
// fingerprinted on their own.
function tokens(content) {
  return content.split(/[^A-Za-z0-9+/_-]+/).filter((token) => token.length >= 32);
}

function secretFindings(content, localEnv = false, exposed = EXPOSED_SECRET_SHA256) {
  const findings = [];
  // Local .env files legitimately hold real secrets; only the exposed-secret fingerprint applies to them.
  if (!localEnv) {
    if (SANDBOX.some((p) => p.test(content))) findings.push('sandbox-credential');
    if (JWT_LITERAL.test(content)) findings.push('jwt-literal-secret');
    const values = [...[...content.matchAll(JWT_ENV_LINE)].map((m) => m[1]), ...[...content.matchAll(JWT_CODE_LITERAL)].map((m) => m[2])];
    if (values.some((v) => v.length >= 16 && !PLACEHOLDER.test(v))) findings.push('jwt-secret-assignment');
  }
  if (tokens(content).some((token) => exposed.has(createHash('sha256').update(token).digest('hex')))) findings.push('exposed-secret-fingerprint');
  return [...new Set(findings)];
}

module.exports = { secretFindings, isLocalEnv, EXPOSED_SECRET_SHA256 };
