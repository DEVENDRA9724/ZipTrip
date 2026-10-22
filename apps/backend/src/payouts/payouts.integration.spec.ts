import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PayoutsService } from './payouts.service';
const Database = require('better-sqlite3');

describe('Payout destination security against an isolated database', () => {
  let directory: string,
    prisma: PrismaClient,
    payouts: PayoutsService,
    previousKey: string | undefined;
  const host = { id: 'host', role: 'HOST' },
    host2 = { id: 'host2', role: 'HOST' };
  const adminA = { id: 'admin-a', role: 'ADMIN' },
    adminB = { id: 'admin-b', role: 'ADMIN' },
    adminC = { id: 'admin-c', role: 'ADMIN' };
  const ACCOUNT_1 = '123456789012',
    ACCOUNT_2 = '998877665544',
    ACCOUNT_3 = '555566667777';
  const bank = (accountNumber = ACCOUNT_1, extra: any = {}) => ({
    accountHolderName: 'Test Host',
    bankName: 'Test Bank',
    accountNumber,
    ifscCode: 'TEST0123456',
    ...extra,
  });
  const output: string[] = [];
  const responses: unknown[] = [];
  const track = async <T>(promise: Promise<T>) => {
    const value = await promise;
    responses.push(value);
    return value;
  };
  const accountOf = (userId: string) =>
    prisma.payoutAccount.findUniqueOrThrow({ where: { userId } });
  const verify = async (by: any, userId: string, revision?: number) => {
    const account = await accountOf(userId);
    return track(
      payouts.updateAccountStatus(by, account.id, {
        status: 'VERIFIED',
        revision: revision ?? account.revision,
      }),
    );
  };
  const audits = (targetId: string, action?: string) =>
    prisma.auditLog.findMany({
      where: { targetId, ...(action ? { action } : {}) },
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    // Capture everything written to stdout/stderr (Nest Logger and console) to prove no bank data is printed.
    for (const stream of [process.stdout, process.stderr]) {
      const write = stream.write.bind(stream);
      jest
        .spyOn(stream, 'write')
        .mockImplementation((chunk: any, ...args: any[]) => {
          output.push(String(chunk));
          return write(chunk, ...args);
        });
    }
    directory = mkdtempSync(join(tmpdir(), 'safar-payouts-'));
    const filename = join(directory, 'test.db');
    const db = new Database(filename);
    db.exec(
      readFileSync(
        join(process.cwd(), 'test/fixtures/sqlite-schema.sql'),
        'utf8',
      ),
    );
    db.close();
    prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: 'file:' + filename }),
    });
    payouts = new PayoutsService(prisma as any);
    previousKey = process.env.PAYOUT_ENCRYPTION_KEY;
    process.env.PAYOUT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    for (const [id, role] of [
      ['host', 'HOST'],
      ['host2', 'HOST'],
      ['admin-a', 'ADMIN'],
      ['admin-b', 'ADMIN'],
      ['admin-c', 'ADMIN'],
      ['customer', 'CUSTOMER'],
    ])
      await prisma.user.create({
        data: {
          id,
          email: id + '@example.invalid',
          passwordHash: 'test-only',
          firstName: 'Test',
          lastName: id,
          role: role as any,
        },
      });
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    if (previousKey === undefined) delete process.env.PAYOUT_ENCRYPTION_KEY;
    else process.env.PAYOUT_ENCRYPTION_KEY = previousKey;
    await prisma?.$disconnect();
    if (directory && directory.startsWith(join(tmpdir(), 'safar-payouts-')))
      rmSync(directory, { recursive: true });
  });

  it('lets a host change only their own bank details and audits the change without the account number', async () => {
    const account: any = await track(
      payouts.saveAccount(host, {
        ...bank(),
        userId: 'host2',
        accountId: 'someone-else',
      }),
    );
    expect(account).toMatchObject({
      userId: 'host',
      status: 'PENDING',
      revision: 1,
      changedById: 'host',
      verifiedRevision: null,
      accountNumberLast4: '9012',
      verificationCurrent: false,
    });
    expect(account).not.toHaveProperty('encryptedAccountNumber');
    expect(account).not.toHaveProperty('fingerprint');
    expect(
      await prisma.payoutAccount.count({ where: { userId: 'host2' } }),
    ).toBe(0);
    await expect(
      payouts.saveAccount({ id: 'customer', role: 'CUSTOMER' }, bank()),
    ).rejects.toThrow('Host or dealer account required');
    const [audit] = await audits(account.id, 'PAYOUT_ACCOUNT_CHANGE_INITIATED');
    expect(audit.actorId).toBe('host');
    expect(JSON.parse(audit.detail)).toMatchObject({
      revision: 1,
      accountNumberLast4: '9012',
    });
  });

  it('requires a different administrator, bound to the reviewed revision, and records failed self-approval', async () => {
    const own: any = await track(
      payouts.saveAccount(
        adminA,
        bank(ACCOUNT_3, { accountHolderName: 'Admin A' }),
      ),
    );
    await expect(
      payouts.updateAccountStatus(adminA, own.id, {
        status: 'VERIFIED',
        revision: 1,
      }),
    ).rejects.toThrow('different administrator');
    expect(
      JSON.parse(
        (await audits(own.id, 'PAYOUT_ACCOUNT_SELF_APPROVAL_REJECTED'))[0]
          .detail,
      ),
    ).toMatchObject({ reason: 'ACCOUNT_OWNER', attempted: 'VERIFIED' });
    await expect(
      payouts.updateAccountStatus(host, own.id, {
        status: 'VERIFIED',
        revision: 1,
      }),
    ).rejects.toThrow('Administrator access required');
    await expect(
      payouts.updateAccountStatus(adminB, own.id, { status: 'VERIFIED' }),
    ).rejects.toThrow('Account revision');
    await expect(
      payouts.updateAccountStatus(adminB, own.id, {
        status: 'VERIFIED',
        revision: 7,
      }),
    ).rejects.toThrow('changed after you opened them');
    expect(await verify(adminB, 'admin-a')).toMatchObject({
      status: 'VERIFIED',
      reviewedById: 'admin-b',
      verifiedRevision: 1,
      verificationCurrent: true,
    });
    // Someone other than the owner who initiated a change also cannot approve it.
    await prisma.payoutAccount.update({
      where: { userId: 'host' },
      data: { changedById: 'admin-c' },
    });
    await expect(verify(adminC, 'host')).rejects.toThrow(
      'different administrator',
    );
    expect(
      JSON.parse(
        (
          await audits(
            (await accountOf('host')).id,
            'PAYOUT_ACCOUNT_SELF_APPROVAL_REJECTED',
          )
        )[0].detail,
      ).reason,
    ).toBe('CHANGE_INITIATOR');
    await prisma.payoutAccount.update({
      where: { userId: 'host' },
      data: { changedById: 'host' },
    });
  });

  it('keeps verification when unchanged details are resubmitted and approves each revision only once', async () => {
    const hostAccount = await accountOf('host');
    const results = await Promise.allSettled([
      verify(adminA, 'host', 1),
      verify(adminB, 'host', 1),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await audits(hostAccount.id, 'PAYOUT_ACCOUNT_VERIFIED'),
    ).toHaveLength(1);
    // Same destination with different spacing/case is not a change.
    const again: any = await track(
      payouts.saveAccount(
        host,
        bank(ACCOUNT_1, {
          accountHolderName: '  test   host ',
          bankName: 'test bank',
          ifscCode: 'test0123456',
        }),
      ),
    );
    expect(again).toMatchObject({
      status: 'VERIFIED',
      revision: 1,
      verifiedRevision: 1,
      verificationCurrent: true,
    });
    expect(
      await audits(hostAccount.id, 'PAYOUT_ACCOUNT_RESUBMITTED_UNCHANGED'),
    ).toHaveLength(1);
    await expect(verify(adminA, 'host', 1)).rejects.toThrow('already verified');
  });

  it('snapshots the destination, invalidates verification on change, holds payouts and never redirects an existing payout', async () => {
    const accountId = (await accountOf('host')).id;
    const p1: any = await track(
      payouts.create(adminA, {
        accountId,
        amount: 5000,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      }),
    );
    expect(p1).toMatchObject({
      destinationState: 'CAPTURED',
      destinationAccountNumberLast4: '9012',
      destinationIfscCode: 'TEST0123456',
      destinationAccountHolderName: 'Test Host',
      destinationAccountRevision: 1,
    });
    expect(p1).not.toHaveProperty('destinationEncryptedAccountNumber');
    expect(await audits(p1.id, 'PAYOUT_SNAPSHOT_CREATED')).toHaveLength(1);
    const snapshot = await prisma.payout.findUniqueOrThrow({
      where: { id: p1.id },
    });

    // The host switches to a different bank account.
    const changed: any = await track(
      payouts.saveAccount(host, bank(ACCOUNT_2)),
    );
    expect(changed).toMatchObject({
      status: 'PENDING',
      revision: 2,
      verifiedRevision: null,
      reviewedById: null,
      verificationCurrent: false,
      accountNumberLast4: '5544',
    });
    expect(
      JSON.parse(
        (await audits(accountId, 'PAYOUT_ACCOUNT_VERIFICATION_INVALIDATED'))[0]
          .detail,
      ),
    ).toMatchObject({
      previousRevision: 1,
      newRevision: 2,
      reason: 'BANK_DETAILS_CHANGED',
    });
    await expect(
      payouts.updateStatus(adminA, p1.id, { status: 'PROCESSING' }),
    ).rejects.toThrow('awaiting verification');
    await expect(
      payouts.updateStatus(adminA, p1.id, {
        status: 'PAID',
        reference: 'UTR-X',
      }),
    ).rejects.toThrow('awaiting verification');
    expect(
      (await audits(p1.id, 'PAYOUT_BLOCKED_UNVERIFIED_DESTINATION')).map(
        (a) => JSON.parse(a.detail).reason,
      ),
    ).toEqual(['ACCOUNT_UNVERIFIED', 'ACCOUNT_UNVERIFIED']);
    await expect(
      payouts.create(adminA, {
        accountId,
        amount: 700,
        periodStart: '2026-12-01',
        periodEnd: '2026-12-31',
      }),
    ).rejects.toThrow('verified by a second approver');
    // A stale approval of the old revision is refused; the current revision needs its own second approval.
    await expect(verify(adminB, 'host', 1)).rejects.toThrow(
      'changed after you opened them',
    );
    await verify(adminB, 'host', 2);
    // Even after verification, the existing payout keeps its original destination and must be reissued, not redirected.
    await expect(
      payouts.updateStatus(adminA, p1.id, { status: 'PROCESSING' }),
    ).rejects.toThrow('differ from this payout');
    const unchanged = await prisma.payout.findUniqueOrThrow({
      where: { id: p1.id },
    });
    for (const field of [
      'destinationAccountNumberLast4',
      'destinationEncryptedAccountNumber',
      'destinationFingerprint',
      'destinationAccountRevision',
      'destinationCapturedAt',
      'amount',
      'status',
    ] as const)
      expect(unchanged[field]).toEqual(snapshot[field]);

    const { cancelled, replacement }: any = await track(
      payouts.reconcile(adminA, p1.id, {
        decision: 'REISSUE',
        note: 'Host changed bank account',
      }),
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(replacement).toMatchObject({
      destinationState: 'CAPTURED',
      destinationAccountNumberLast4: '5544',
      destinationAccountRevision: 2,
      status: 'PENDING',
    });
    expect(Number(replacement.amount)).toBe(5000);
    expect(
      JSON.parse((await audits(p1.id, 'PAYOUT_RECONCILED'))[0].detail),
    ).toMatchObject({
      decision: 'REISSUE',
      reason: 'DESTINATION_SUPERSEDED',
      replacementPayoutId: replacement.id,
    });

    // Phase 2/3 rules still apply on the replacement.
    await track(
      payouts.updateStatus(adminA, replacement.id, {
        status: 'PROCESSING',
        reference: 'BATCH-1',
      }),
    );
    await expect(
      payouts.updateStatus(adminA, replacement.id, { status: 'CANCELLED' }),
    ).rejects.toThrow('PROCESSING payout cannot be changed to CANCELLED');
    await expect(
      payouts.updateStatus(adminA, replacement.id, { status: 'PAID' }),
    ).rejects.toThrow('UTR');
    const paid: any = await track(
      payouts.updateStatus(adminA, replacement.id, {
        status: 'PAID',
        reference: 'UTR-1001',
      }),
    );
    expect(paid).toMatchObject({ status: 'PAID', reference: 'UTR-1001' });
    await expect(
      payouts.updateStatus(adminA, replacement.id, { status: 'PENDING' }),
    ).rejects.toThrow('PAID payout cannot be changed to PENDING');
    expect((await audits(replacement.id)).map((a) => a.action)).toEqual([
      'PAYOUT_CREATED',
      'PAYOUT_SNAPSHOT_CREATED',
      'PAYOUT_PROCESSING',
      'PAYOUT_PAID',
    ]);
  });

  it('records PAID for a payout already processing once no unverified change is pending', async () => {
    const accountId = (await accountOf('host')).id;
    const p: any = await payouts.create(adminA, {
      accountId,
      amount: 900,
      periodStart: '2027-01-01',
      periodEnd: '2027-01-31',
    });
    await payouts.updateStatus(adminA, p.id, { status: 'PROCESSING' });
    await payouts.saveAccount(host, bank(ACCOUNT_1));
    await expect(
      payouts.updateStatus(adminA, p.id, {
        status: 'PAID',
        reference: 'UTR-77',
      }),
    ).rejects.toThrow('awaiting verification');
    await verify(adminB, 'host');
    // The transfer already went to the snapshot destination, so the result can be recorded against it.
    expect(
      await payouts.updateStatus(adminA, p.id, {
        status: 'PAID',
        reference: 'UTR-77',
      }),
    ).toMatchObject({ status: 'PAID', destinationAccountNumberLast4: '5544' });
  });

  it('never leaves an approval bound to a revision other than the current one under concurrent change and approval', async () => {
    const accountId = (await accountOf('host')).id;
    await payouts.saveAccount(host, bank(ACCOUNT_2));
    const before = await accountOf('host');
    await Promise.allSettled([
      payouts.saveAccount(host, bank(ACCOUNT_3)),
      verify(adminB, 'host', before.revision),
    ]);
    const after = await accountOf('host');
    if (after.status === 'VERIFIED')
      expect(after.verifiedRevision).toBe(after.revision);
    else expect(after.verifiedRevision).toBeNull();
    expect(after.revision).toBe(before.revision + 1);
    const verifiedAudits = (
      await audits(accountId, 'PAYOUT_ACCOUNT_VERIFIED')
    ).map((a) => JSON.parse(a.detail).revision);
    expect(new Set(verifiedAudits).size).toBe(verifiedAudits.length);
  });

  it('holds legacy payouts with unknown destinations until an explicit reconciliation decision', async () => {
    await payouts.saveAccount(
      host2,
      bank('111122223333', { accountHolderName: 'Second Host' }),
    );
    await verify(adminA, 'host2');
    const accountId = (await accountOf('host2')).id;
    // Rows as left by the migration: no snapshot, state chosen from the final/non-final status.
    const legacy = async (
      status: string,
      destinationState: string,
      reference: string | null = null,
    ) =>
      (
        await prisma.payout.create({
          data: {
            accountId,
            amount: 1500,
            status,
            reference,
            destinationState,
          },
        })
      ).id;
    const pending = await legacy('PENDING', 'RECONCILIATION_REQUIRED');
    const failed = await legacy('FAILED', 'RECONCILIATION_REQUIRED');
    const processing = await legacy(
      'PROCESSING',
      'RECONCILIATION_REQUIRED',
      'OLD-BATCH',
    );
    const paid = await legacy('PAID', 'LEGACY_UNVERIFIED', 'OLD-UTR');
    for (const [id, status] of [
      [pending, 'PROCESSING'],
      [pending, 'PAID'],
      [processing, 'PAID'],
    ] as const)
      await expect(
        payouts.updateStatus(adminB, id, { status, reference: 'UTR-L' }),
      ).rejects.toThrow('no verified destination');
    expect(
      (await audits(pending, 'PAYOUT_BLOCKED_UNVERIFIED_DESTINATION')).every(
        (a) => JSON.parse(a.detail).reason === 'RECONCILIATION_REQUIRED',
      ),
    ).toBe(true);
    await expect(
      payouts.reconcile(adminB, paid, { decision: 'CANCEL', note: 'x' }),
    ).rejects.toThrow('does not need reconciliation');
    await expect(
      payouts.reconcile(adminB, processing, { decision: 'CANCEL', note: 'x' }),
    ).rejects.toThrow('Record the bank result');
    expect(
      (
        await track(
          payouts.reconcile(adminB, pending, {
            decision: 'CANCEL',
            note: 'Destination unknown',
          }) as Promise<any>,
        )
      ).cancelled.status,
    ).toBe('CANCELLED');
    const reissued: any = await track(
      payouts.reconcile(adminB, failed, {
        decision: 'REISSUE',
        note: 'Pay current verified account',
      }),
    );
    expect(reissued.replacement).toMatchObject({
      destinationState: 'CAPTURED',
      destinationAccountNumberLast4: '3333',
    });
    // The legacy PAID record keeps its amount, reference and state.
    expect(
      await prisma.payout.findUniqueOrThrow({ where: { id: paid } }),
    ).toMatchObject({
      status: 'PAID',
      reference: 'OLD-UTR',
      destinationState: 'LEGACY_UNVERIFIED',
      destinationEncryptedAccountNumber: null,
    });
    expect(
      await prisma.payout.findUniqueOrThrow({ where: { id: processing } }),
    ).toMatchObject({ status: 'PROCESSING', reference: 'OLD-BATCH' });
  });

  it('validates periods, rejects duplicates under concurrency and keeps references on blank updates', async () => {
    const accountId = (await accountOf('host2')).id;
    await expect(
      payouts.create(adminA, {
        accountId,
        amount: 10,
        periodStart: 'not-a-date',
      }),
    ).rejects.toThrow('valid period start');
    await expect(
      payouts.create(adminA, {
        accountId,
        amount: 10,
        periodStart: '2026-10-31',
        periodEnd: '2026-10-01',
      }),
    ).rejects.toThrow('on or after');
    await expect(
      payouts.create(adminA, { accountId, amount: 50.005 }),
    ).rejects.toThrow('two decimal');
    const input = {
      accountId,
      amount: 2500,
      periodStart: '2027-02-01',
      periodEnd: '2027-02-28',
    };
    const results = await Promise.allSettled([
      payouts.create(adminA, input),
      payouts.create(adminB, input),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (results.find((r) => r.status === 'rejected') as PromiseRejectedResult)
        .reason.message,
    ).toContain('identical payout');
    const created = (
      results.find(
        (r) => r.status === 'fulfilled',
      ) as PromiseFulfilledResult<any>
    ).value;
    await payouts.updateStatus(adminA, created.id, {
      status: 'FAILED',
      reference: 'BANK-RETURN-7',
    });
    expect(
      (
        await payouts.updateStatus(adminA, created.id, {
          status: 'PENDING',
          reference: '',
        })
      ).reference,
    ).toBe('BANK-RETURN-7');
    // Two administrators marking the same payout PAID at once: one wins, one audit row.
    const paid = await Promise.allSettled([
      payouts.updateStatus(adminA, created.id, {
        status: 'PAID',
        reference: 'UTR-A',
      }),
      payouts.updateStatus(adminB, created.id, {
        status: 'PAID',
        reference: 'UTR-B',
      }),
    ]);
    expect(paid.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await audits(created.id, 'PAYOUT_PAID')).toHaveLength(1);
  });

  it('never exposes full account numbers or ciphertext in responses, audit entries or logs', async () => {
    const accounts = await payouts.listAccounts(adminA);
    const list = await payouts.list(adminA);
    const own = await payouts.getAccount(host);
    const hostPayouts = await payouts.list(host);
    responses.push(accounts, list, own, hostPayouts);
    expect(
      list.every(
        (p: any) =>
          typeof p.destinationReady === 'boolean' &&
          !('fingerprint' in p.account),
      ),
    ).toBe(true);
    const ciphertexts = (await prisma.payoutAccount.findMany()).map(
      (a) => a.encryptedAccountNumber,
    );
    const auditText = (await prisma.auditLog.findMany())
      .map((a) => a.detail)
      .join('\n');
    const visible = [JSON.stringify(responses), auditText, output.join('')];
    for (const text of visible) {
      for (const secret of [
        ACCOUNT_1,
        ACCOUNT_2,
        ACCOUNT_3,
        '111122223333',
        ...ciphertexts,
      ])
        expect(text).not.toContain(secret);
      expect(text).not.toMatch(
        /"(encryptedAccountNumber|destinationEncryptedAccountNumber|fingerprint|destinationFingerprint)"/,
      );
    }
  });
});
