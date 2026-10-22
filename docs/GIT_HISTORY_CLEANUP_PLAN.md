# Git History Cleanup Runbook: leaked credentials

| | |
|---|---|
| Status | **PLAN ONLY. Not executed.** Needs explicit written approval, and credential rotation must be confirmed first (`docs/CREDENTIAL_ROTATION_CHECKLIST.md`). The materials and the step-by-step checklist with go/no-go gates are in `docs/history-cleanup/` (Phase 9): the path list, the read-only `verify-rewrite.cjs` gate script and `EXECUTION_CHECKLIST.md`. |
| Prepared | 2026-10-11; revised 2026-10-12 (Phase 8) with a verified ref inventory and safer publish steps |
| Repository | `https://github.com/DEVENDRA9724/ZipTrip.git` (origin) |
| Affected commit | `0e6e599` "Initial commit" (2026-10-03). It is an ancestor of every later commit, so **every commit hash will change.** |

## 1. Why history must be rewritten, and why that is not enough

- Deleting the files in the working tree (done locally in Phase 1, **not yet committed**) only keeps them out of future commits. Every earlier commit, clone, fork and GitHub cache still contains them.
- **Rotating the credentials is the real fix.** Rewriting history only limits further exposure. Anyone who already cloned or fetched the repo keeps the old values.

## 2. Findings (read-only scan, 2026-10-12)

`npm --prefix apps/backend run secrets:scan-history` reports 4 file versions, all introduced in `0e6e599` and reachable from `main`, `new-change` and `origin/main`. Values are never printed or reproduced here.

| Path | Rules | Credential | Rotation action |
|---|---|---|---|
| `scripts/test-fetch-files.js` | `sandbox-credential`, `exposed-secret-fingerprint` | Sandbox.co.in **live** API key and secret | Revoke in the Sandbox dashboard and issue new ones |
| `scripts/test-sandbox-session.js` | same | same key pair | (same) |
| `scripts/test-approval.js` | `jwt-literal-secret`, `exposed-secret-fingerprint` | JWT signing secret (96 hex characters) | Replace `JWT_SECRET` in every environment |
| `scripts/test-doc-evidence.js` | same | same JWT secret | (same) |

**Personal data, no credentials, removed in the same pass:**
- `scripts/promote-admin.js` and `scripts/check-devendra-docs.js` (a personal email and user identifiers).
- `scripts/test-direct-call.js` (a document UUID).

**Detection verified (Phase 8).** All three exposed fingerprints in `apps/backend/scripts/secret-detectors.cjs` match values in the historical files. The detectors flag those values in `.env` assignments (`KEY=value`, `export KEY="value"`, quoted values, trailing comments) and in code. A freshly generated secret is not flagged.

## 3. Ref inventory (verified read-only, 2026-10-12)

| Where | Refs | Notes |
|---|---|---|
| GitHub (`git ls-remote origin`) | `HEAD`, `refs/heads/main` | No tags, no other branches, no `refs/pull/*` (no pull requests) |
| This clone | `main`, `new-change`, `origin/main`, `origin/HEAD` | All at `79a1280`. `new-change` holds about 105 uncommitted working-tree changes (Phases 0–8). |
| Forks | **Unknown.** `gh` is not installed here. | Check on GitHub (repository → Insights → Forks) before starting. |

**Re-check all of this immediately before executing.** Anything new (branches, tags, pull requests, forks) must be added to the plan.

## 4. Preconditions (all required, in this order)

1. **Credentials rotated and the old ones confirmed revoked** (rotation checklist §2–3). Rewriting first gains nothing: the values are already public.
2. **Current work committed and published under its own approval.** The Phase 0–8 working-tree changes include the deletion of the leaked scripts, so they should be committed and pushed before the rewrite. The rewrite then covers one complete history, and nobody has to rebase work onto it. If that is not approved, use the patch route in §5.1.
3. **Every collaborator told in advance**, with a date and time. That includes the GitHub account holder DEVENDRA9724. They must push or export their work and then stop pushing until §5.7.
4. **Forks and other clones listed** (§3). Fork owners must delete or rewrite their forks.
5. **Branch protection known.** A force-push to `main` may need protection to be relaxed temporarily, and then restored (§5.5).
6. **This runbook approved in writing**, including the force-push to `main`.

## 5. Procedure

Work in a **separate folder with fresh mirror clones**, never in the working copy.

### 5.1 Preserve local work (non-destructive)
Do not use `git stash` here: it changes the working tree.
```bash
cd "E:/Andrew Projects/ZipTrip"
git status --porcelain > ../ziptrip-wip-status.txt
git diff HEAD --binary > ../ziptrip-wip.patch                       # tracked changes, including deletions
git ls-files --others --exclude-standard -z | tar --null -T - -cf ../ziptrip-wip-untracked.tar   # new files
```
- Ignored local data (`apps/backend/.env`, `apps/backend/portal.db`, `apps/backend/backups/`) is not touched by a rewrite. Copy the folder as well if in doubt.

### 5.2 Back up (before any rewrite)
```bash
mkdir -p ~/ziptrip-rewrite && cd ~/ziptrip-rewrite
git clone --mirror https://github.com/DEVENDRA9724/ZipTrip.git pre-rewrite.git
git -C pre-rewrite.git bundle create ../ZipTrip-pre-rewrite-$(date +%Y%m%d).bundle --all   # -> ~/ziptrip-rewrite/
git -C pre-rewrite.git bundle verify ../ZipTrip-pre-rewrite-$(date +%Y%m%d).bundle         # must report "is okay"
git -C pre-rewrite.git show-ref > refs-before.txt
git -C pre-rewrite.git rev-parse refs/heads/main > main-before.txt    # needed for --force-with-lease
```
- **The bundle still contains the leaked secrets.** Create it only after explicit owner authorization, and follow "Backup safety" in `docs/history-cleanup/EXECUTION_CHECKLIST.md`: encrypted offline storage with restricted access, integrity and recovery checks without exposing contents, retention, and secure destruction. Never upload it.

### 5.3 Rewrite
Install the tool with `pip install git-filter-repo` (Python 3). It is not installed on this machine.
```bash
git clone --mirror https://github.com/DEVENDRA9724/ZipTrip.git rewrite.git
cd rewrite.git
git filter-repo --invert-paths --paths-from-file "E:/Andrew Projects/ZipTrip/docs/history-cleanup/paths-to-remove.txt" --replace-refs delete-no-add   # no refs/replace (the verifier rejects them)
```
- The path file lists the same 7 paths as §2.
- `git filter-repo` **removes the `origin` remote** on purpose. Do not add it back until §5.4 passes: that is the first safeguard against an early push.
- If §5.4 finds a secret anywhere else, add a `--replace-text <file>` pass. Keep that file outside every repository and delete it afterwards.

### 5.4 Verify the rewritten mirror (no values printed)
**Primary gate:** run the combined read-only script. It checks ref names, removed paths, tip trees and commit counts, and runs the credential scanner.
```bash
node "E:/Andrew Projects/ZipTrip/docs/history-cleanup/verify-rewrite.cjs" --old ~/ziptrip-rewrite/pre-rewrite.git --new ~/ziptrip-rewrite/rewrite.git
#   expect: every line PASS, exit code 0. Any FAIL means "do not publish".
```
**Individual checks.** These are equivalent to the script and useful for diagnosis. Run them from the working copy, which contains the scanner:
```bash
node "E:/Andrew Projects/ZipTrip/apps/backend/scripts/scan-git-history.cjs" --repo ~/ziptrip-rewrite/rewrite.git
#   expect: "No findings in history." and exit code 0
git -C ~/ziptrip-rewrite/rewrite.git log --all --oneline -- scripts/test-fetch-files.js | wc -l   # expect 0
git -C ~/ziptrip-rewrite/rewrite.git show-ref > ~/ziptrip-rewrite/refs-after.txt   # same ref names as refs-before.txt
```
- **Tree check:** the new `main` must differ from the old `main` only by the removed paths. Compare in a scratch repository that has both histories:
  ```bash
  cd ~/ziptrip-rewrite && git init cmp && cd cmp
  git fetch ../pre-rewrite.git main:old
  git fetch ../rewrite.git main:new
  git diff --stat old new        # only the 7 removed scripts may appear
  ```
- **Build check:** clone the rewritten mirror into a scratch folder, run `npm ci` and `npx jest` in `apps/backend`, and run `npm run test:web` at the root.
- The `--repo` option of the scanner was verified in Phase 8:
  - On a local mirror of this repository it reports the same 4 findings.
  - On a clean repository it reports none and exits 0.

### 5.5 Publish (destructive; needs the approval in §4.6)
```bash
cd ~/ziptrip-rewrite/rewrite.git
git remote add origin https://github.com/DEVENDRA9724/ZipTrip.git
git ls-remote origin                                                   # must still match refs-before.txt
git push --force-with-lease=refs/heads/main:$(cat ../main-before.txt) origin refs/heads/main:refs/heads/main
# Push any other branches or tags listed in §3 the same way, one lease per ref.
```
- **Do not use `git push --mirror`.**
  - It deletes remote refs that are missing locally.
  - It tries to push GitHub's read-only `refs/pull/*`.
- **`--force-with-lease` with the recorded hash refuses the push** if anyone pushed after the backup. In that case, stop, fetch, and start again from §5.2.
- Restore branch protection immediately after the push.

### 5.6 After publishing
- **Fresh clone check:** clone fresh from GitHub and run the scanner on it, both with `--repo <fresh clone>` and from inside the clone. Expect no findings.
- **GitHub:**
  - Close any **Security → Secret scanning** alerts as "revoked".
  - Ask **GitHub Support** to remove cached views of the old commits and to garbage-collect unreachable objects. Until then, old commits can still be opened by their hash.
- Record in the release notes the date and the old and new `main` hashes, with no secret values.

### 5.7 Existing clones and forks
- **Every clone must be replaced, not updated.** `git pull` into an old clone merges the old history back in, and pushing it would republish the secrets.
- **Check for old history:** `git cat-file -e 0e6e599^{commit} && echo "OLD HISTORY PRESENT"`. Any clone that prints this must not push.
- **This machine:**
  ```bash
  cd "E:/Andrew Projects"
  git clone https://github.com/DEVENDRA9724/ZipTrip.git ZipTrip-clean
  cd ZipTrip-clean
  git apply ../ziptrip-wip.patch    # only if §4.2 was not done
  tar -xf ../ziptrip-wip-untracked.tar
  ```
  Then copy the ignored local files (`apps/backend/.env`, `portal.db`, `backups/`), run the checks, and retire the old folder only after the clean clone passes.
- **Forks:** the owner of each fork must delete it, or rewrite it the same way. Forks keep the leaked values whatever happens here; rotation is what makes them harmless.

## 6. Recovery / rollback

If the rewritten history is wrong (missing commits, broken tree):
```bash
git clone --mirror ~/ziptrip-rewrite/ZipTrip-pre-rewrite-YYYYMMDD.bundle restore.git
cd restore.git && git remote add origin https://github.com/DEVENDRA9724/ZipTrip.git
git push --force-with-lease=refs/heads/main:<hash of the rewritten main> origin refs/heads/main:refs/heads/main
```
- **Restoring republishes the leaked secrets.** Do it only after they have been revoked, and repeat the rewrite promptly.
- **Local working copy:** nothing in §5 changes it. If needed, `git apply ../ziptrip-wip.patch` and `tar -xf ../ziptrip-wip-untracked.tar` restore the work in any clone.

## 7. Effects to communicate

- **Every commit hash changes.** Hashes quoted in documents (for example `79a1280` and `0e6e599`) will no longer resolve.
- Open pull requests based on the old history must be recreated. There are none as of 2026-10-12.
- There is currently no CI. Deploy keys and webhooks are unaffected.
- Forks and earlier clones keep the secrets. Rotation is what makes those copies harmless.
