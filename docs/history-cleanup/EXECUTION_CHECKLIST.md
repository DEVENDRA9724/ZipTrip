# History Cleanup: Execution Checklist

| | |
|---|---|
| Status | **Prepared for review (Phase 9; reviewed and hardened in Phase 11, 2026-10-12). NOT EXECUTED.** Nothing in this folder rewrites history, changes refs or contacts GitHub. |
| Runbook | `docs/GIT_HISTORY_CLEANUP_PLAN.md` (reasons, ref inventory, full commands) |
| Executor | The repository owner, with written approval. Not an automated agent. |

## Contents of this folder

There are no secret values here. Only file paths, commands and read-only checks.

| File | Purpose |
|---|---|
| `paths-to-remove.txt` | The 7 paths to remove from all history, as input to `git filter-repo --paths-from-file … --invert-paths`. |
| `verify-rewrite.cjs` | Read-only gate script. It **fails closed**: exit 0 only if every gate passes; any error, missing input or unexpected state is a FAIL. |
| `EXECUTION_CHECKLIST.md` | This checklist. |

**The Git backup bundle is deliberately not included.** See "Backup safety" below.

### Evidence for each path (Phase 11, read-only; no values printed)

| Path | Why it is removed | Evidence |
|---|---|---|
| `scripts/test-fetch-files.js` | Credentials | Scanner: `sandbox-credential`, `exposed-secret-fingerprint` (Sandbox live key and secret) |
| `scripts/test-sandbox-session.js` | Credentials | Scanner: `sandbox-credential`, `exposed-secret-fingerprint` |
| `scripts/test-approval.js` | Credentials and personal data | Scanner: `jwt-literal-secret`, `exposed-secret-fingerprint`; also 1 personal email and 1 UUID |
| `scripts/test-doc-evidence.js` | Credentials and personal data | Scanner: `jwt-literal-secret`, `exposed-secret-fingerprint`; also 1 personal email and 1 UUID |
| `scripts/promote-admin.js` | Personal data only | 1 personal email address. The scanner does not detect personal data. |
| `scripts/check-devendra-docs.js` | Personal data only | 1 personal email address |
| `scripts/test-direct-call.js` | Personal data only | 1 document UUID |

- **History:** all 7 appear only in commit `0e6e599`.
- **HEAD:** all 7 are still in the committed tree at HEAD. They are deleted only in the uncommitted working tree.
- **Scope decision for the owner:** the 4 credential files are required. The 3 personal-data files are recommended but optional. Removing a path from the list also removes it from the tip-tree gate.

### What the verifier checks
- **Inputs:** both repositories exist and differ, and the path list is non-empty.
- **Refs:** the same branch and tag names; **no refs outside `refs/heads`, `refs/tags`** (GitHub's read-only `refs/pull/*` are ignored and never pushed); `refs/replace`, `refs/notes`, `refs/remotes` and similar fail.
- **Removed paths:** none is reachable from any ref.
- **Tip trees:** each branch's and tag's tip tree equals the old one minus the removed paths.
- **Commit counts:** the same per branch.
- **Secret scan:** the repository credential scanner (all detectors and the three exposed fingerprints) reports "No findings in history".

**Tests:** `apps/backend/src/common/history-cleanup-verifier.spec.ts` (6 tests, part of the Jest suite) builds synthetic repositories from scratch, with no history rewriting:
- a cleaned history **passes**;
- an uncleaned history, a secret in a path not on the list, an extra branch, a `refs/replace` ref, changed content, lost commits, an empty path list, a missing repository, and the same repository given as old and new all **fail**;
- the fake credential, generated at runtime, never appears in the output.

**Real repository:** on an unmodified mirror of this repository the verifier reports 4 FAIL and "Do NOT publish" (Phase 11).

## A. Go / no-go: all must be ticked before any command in B

Credential revocation (A1) is a **separate, earlier stage** from the history rewrite. The rewrite does not revoke anything, and revocation does not depend on the rewrite.

- [ ] **A1. Credentials rotated and the old ones verified revoked.** Every row in `docs/CREDENTIAL_ROTATION_CHECKLIST.md` §6 is complete: Sandbox key, Sandbox secret and JWT secret. That includes the new JWT secret deployed, so sessions signed with the leaked secret are already invalid.
- [ ] **A2. Explicit written owner authorization** for executing this checklist, creating the backup (B), and the force-push to `main` (D). Record who approved it and when.
- [ ] **A3. Local Phase 0–11 work committed and pushed** under its own authorization, or saved as a patch (runbook §5.1).
- [ ] **A4. Collaborators notified**, with a freeze window. That includes DEVENDRA9724. No pushes from the start of B until E2.
- [ ] **A5. Ref inventory re-checked.** `git ls-remote origin` still shows only `HEAD` and `refs/heads/main`, or the plan has been updated for any new branches or tags.
- [ ] **A6. Forks checked** on GitHub (Insights → Forks), and their owners contacted. Forks keep the old history; rotation (A1) is what protects them.
- [ ] **A7. Branch-protection settings recorded**, to be restored in D3.
- [ ] **A8. Tools ready.** `git filter-repo` installed (`pip install git-filter-repo`; it is not installed on this machine), and Node 22 available to run the verifier.

## Backup safety (applies to B)

The backup preserves the full old history, **including the leaked credentials**, so it is sensitive data.

- **When:** create it only after A2, immediately before the rewrite. Never during ordinary verification or development. No backup was created during Phases 8–11.
- **Where:** on encrypted storage with restricted access:
  - an encrypted removable drive (for example BitLocker To Go) kept offline; or
  - an encrypted archive (for example `gpg --symmetric --cipher-algo AES256`, or 7-Zip AES-256 with encrypted file names) on such a drive.

  Only the repository owner, and one named deputy if needed, hold the key or passphrase. Keep the passphrase in a password manager, never next to the file.
- **Never:**
  - upload it to cloud storage, GitHub, chat, email or a ticket;
  - place it inside any project folder;
  - include it in ordinary backups or artifacts.
- **Integrity, without exposing contents:**
  - `git bundle verify` must report "is okay".
  - Record `sha256sum` of the encrypted file in the release notes; the hash reveals nothing.
  - Record the ref list (`show-ref`). It holds commit hashes only, no file contents.
- **Recovery test**, without exposing contents: in an encrypted, temporary location, run `git clone --mirror <bundle> test.git && git -C test.git show-ref`. The refs must equal `refs-before.txt`. Delete `test.git` immediately afterwards. Do not check out files and do not open or print any file contents.
- **Retention:** keep it until the rewrite is published (D), every clone has been replaced (E2) and the clean state has been stable for 30 days. Then destroy it.
- **Secure destruction:** delete the encrypted file and any temporary copies. Where possible, destroy the encryption key or reformat the encrypted volume (crypto-erase). Record the date and method in the release notes.

## B. Backup (outside the working copy; only after A1–A8)

- [ ] **B1.** On the encrypted volume: `git clone --mirror https://github.com/DEVENDRA9724/ZipTrip.git pre-rewrite.git`
- [ ] **B2.**
  - `git -C pre-rewrite.git bundle create ../ZipTrip-pre-rewrite-<date>.bundle --all`
  - `git -C pre-rewrite.git bundle verify ../ZipTrip-pre-rewrite-<date>.bundle` must say "is okay".
  - Encrypt the bundle, or keep it on the encrypted volume, and run the recovery test above.
- [ ] **B3.** Record the refs: `git -C pre-rewrite.git show-ref > refs-before.txt` and `git -C pre-rewrite.git rev-parse refs/heads/main > main-before.txt`

## C. Rewrite and verify (still nothing published)

- [ ] **C1.** `git clone --mirror https://github.com/DEVENDRA9724/ZipTrip.git rewrite.git && cd rewrite.git`
- [ ] **C2.** `git filter-repo --invert-paths --paths-from-file "<repo>/docs/history-cleanup/paths-to-remove.txt" --replace-refs delete-no-add`
  - `--replace-refs delete-no-add` stops `filter-repo` creating `refs/replace/*`, which the verifier would reject.
  - `filter-repo` also removes the `origin` remote. Leave it removed until C3 passes.
- [ ] **C3.** `node "<repo>/docs/history-cleanup/verify-rewrite.cjs" --old <encrypted volume>/pre-rewrite.git --new rewrite.git` reports **all PASS and exit 0**. On any FAIL, stop: nothing has been published.
- [ ] **C4.** Clone `rewrite.git` into a scratch folder. In `apps/backend` run `npm ci && npx jest`, and at the root run `npm ci && npm run test:web`. Both must pass.
- [ ] **C5.** A second person reviews the C3 output and the C4 results and signs off.

## D. Publish (destructive; only with the explicit owner authorization in A2)

- [ ] **D1.** In `rewrite.git`: `git remote add origin https://github.com/DEVENDRA9724/ZipTrip.git`. Then `git ls-remote origin`: `main` must still equal `main-before.txt`. Otherwise someone pushed, so stop and restart from B.
- [ ] **D2.** `git push --force-with-lease=refs/heads/main:$(cat ../main-before.txt) origin refs/heads/main:refs/heads/main`. Add one lease per extra branch or tag if A5 found any. **Never `--mirror`.**
- [ ] **D3.** Restore branch protection exactly as recorded in A7.

## E. After publishing

- [ ] **E1.** Fresh clone from GitHub, then `node apps/backend/scripts/scan-git-history.cjs` inside it reports "No findings in history".
- [ ] **E2.** Lift the freeze. Every collaborator re-clones; nobody pulls into an old clone. Check old clones with `git cat-file -e 0e6e599^{commit}`: any clone where this succeeds still holds the old history, must not push, and should be deleted.
- [ ] **E3.** On GitHub: close secret-scanning alerts as revoked, and ask GitHub Support to purge cached views and unreachable objects. Until then, old commits stay reachable by their hash, which is why A1 must come first.
- [ ] **E4.** Replace this working copy (runbook §5.7), including copying ignored local files (`.env`, `portal.db`, `backups/`) by hand. **Never commit them.**
- [ ] **E5.** Record the date and the old and new `main` hashes in the release notes, with no secret values. Update hash references in the docs. Destroy the backup when its retention period ends (see "Backup safety").

## Rollback

Before D2, nothing is published, so delete `rewrite.git` and start again. After D2, follow runbook §6, which restores from the B2 bundle. **Restoring republishes the leaked values**, so do it only after A1 and repeat the rewrite promptly.
