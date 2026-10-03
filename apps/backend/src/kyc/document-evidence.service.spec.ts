import { DocumentEvidenceService } from './document-evidence.service';
import { KycController } from './kyc.controller';
import { AdminController } from '../admin/admin.controller';

describe('Original document evidence', () => {
  const doc = { userId: 'owner', kind: 'DL', source: 'DIGILOCKER_LIVE', providerSessionId: 'session', mediaId: null };
  let prisma: any;
  let sandbox: any;
  let service: DocumentEvidenceService;
  beforeEach(() => {
    prisma = {
      kycSession: { findUnique: jest.fn().mockResolvedValue({ userId: 'owner', environment: 'live', providerId: 'provider/session' }) },
      media: { findFirst: jest.fn() },
      document: { findFirst: jest.fn(), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    sandbox = { environment: jest.fn(() => 'live'), call: jest.fn() };
    service = new DocumentEvidenceService(prisma, sandbox);
  });

  it('preserves every original PDF/XML file and its exact signed URL', async () => {
    const files = [
      { url: 'https://issuer.example/dl.xml?signature=a%2Fb%2Bc&expires=123', metadata: { ContentType: 'application/xml' } },
      { url: 'https://issuer.example/dl.pdf?signature=xyz', metadata: { ContentType: 'application/pdf' } },
    ];
    sandbox.call.mockResolvedValue({ files });
    expect(await service.original(doc)).toEqual({ source: 'DIGILOCKER', environment: 'live', files });
    expect(sandbox.call).toHaveBeenCalledWith('/kyc/digilocker/sessions/provider%2Fsession/documents/driving_license');
  });

  it('uses the Aadhaar provider path and labels test files as test', async () => {
    sandbox.environment.mockReturnValue('test');
    prisma.kycSession.findUnique.mockResolvedValue({ userId: 'owner', environment: 'test', providerId: 'provider' });
    sandbox.call.mockResolvedValue({ files: [{ url: 'https://issuer.example/aadhaar.xml' }] });
    expect((await service.original({ ...doc, kind: 'AADHAAR', source: 'DIGILOCKER_TEST' })).environment).toBe('test');
    expect(sandbox.call).toHaveBeenCalledWith('/kyc/digilocker/sessions/provider/documents/aadhaar');
  });

  it('does not reconstruct a document when its linked session is missing', async () => {
    await expect(service.original({ ...doc, providerSessionId: null })).rejects.toThrow('No DigiLocker session');
    expect(sandbox.call).not.toHaveBeenCalled();
  });

  it.each([null, { userId: 'other', environment: 'live' }])('rejects missing or foreign sessions: %p', async session => {
    prisma.kycSession.findUnique.mockResolvedValue(session);
    await expect(service.original(doc)).rejects.toThrow('Original document unavailable');
    expect(sandbox.call).not.toHaveBeenCalled();
  });

  it('rejects an environment mismatch before contacting the provider', async () => {
    sandbox.environment.mockReturnValue('test');
    await expect(service.original(doc)).rejects.toThrow('different Sandbox environment');
    expect(sandbox.call).not.toHaveBeenCalled();
  });

  it.each([{}, { files: [] }, { files: [{ url: '#' }, { url: 'javascript:alert(1)' }, { url: 'http://issuer.example/a.pdf' }, { url: 'https://user:pass@issuer.example/a.pdf' }] }])('rejects missing or unsafe originals without a fallback: %p', async result => {
    sandbox.call.mockResolvedValue(result);
    await expect(service.original(doc)).rejects.toThrow('provider returned no original files');
  });

  it('reports provider failures without substituting a certificate or leaking its error', async () => {
    sandbox.call.mockRejectedValue(new Error('private provider details'));
    await expect(service.original(doc)).rejects.toThrow('DigiLocker/Sandbox could not return the file');
  });

  it('retrieves a fresh link for each retry', async () => {
    sandbox.call.mockResolvedValueOnce({ files: [{ url: 'https://issuer.example/dl.pdf?signature=first' }] })
      .mockResolvedValueOnce({ files: [{ url: 'https://issuer.example/dl.pdf?signature=second' }] });
    await service.original(doc);
    expect((await service.original(doc)).files[0].url).toContain('signature=second');
    expect(sandbox.call).toHaveBeenCalledTimes(2);
  });

  it('recovers unavailable evidence from a recent matching record and returns its actual ID', async () => {
    const candidate = { ...doc, id: 'new-doc', providerSessionId: 'recent-session' };
    prisma.kycSession.findMany = jest.fn().mockResolvedValue([{ id: 'recent-session' }]);
    prisma.document.findMany = jest.fn().mockResolvedValue([candidate]);
    sandbox.call.mockRejectedValueOnce(new Error('Data not found for old session'))
      .mockResolvedValueOnce({ files: [{ url: 'https://issuer.example/original.pdf' }] });
    const result = await service.available({ ...doc, id: 'old-doc' });
    expect(result.documentId).toBe('new-doc');
    expect(result).toHaveProperty('notice');
    expect(prisma.document.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'owner', kind: 'DL', source: 'DIGILOCKER_LIVE' });
    expect(prisma.kycSession.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'owner', environment: 'live', status: 'succeeded' }, take: 3 });
  });

  it('does not search other records on billing or unknown provider failures', async () => {
    prisma.kycSession.findMany = jest.fn();
    sandbox.call.mockRejectedValue(new Error('Insufficient credits'));
    await expect(service.available({ ...doc, id: 'old-doc' })).rejects.toThrow('insufficient credits');
    expect(prisma.kycSession.findMany).not.toHaveBeenCalled();
  });

  it('gives a re-verification instruction when recent sessions have no available original', async () => {
    prisma.kycSession.findMany = jest.fn().mockResolvedValue([]);
    prisma.document.findMany = jest.fn().mockResolvedValue([]);
    sandbox.call.mockResolvedValue({ files: [] });
    await expect(service.available({ ...doc, id: 'old-doc' })).rejects.toThrow('Start a new DigiLocker verification');
  });

  it('audits the displayed fallback record rather than the unavailable selected record', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...doc, id: 'old-doc' });
    jest.spyOn(service, 'available').mockResolvedValue({ documentId: 'new-doc', source: 'DIGILOCKER', environment: 'live', files: [{ url: 'https://issuer.example/file.pdf' }] });
    await new AdminController(prisma, service).evidence({ user: { id: 'admin', role: 'ADMIN' } }, 'old-doc');
    expect(prisma.auditLog.create.mock.calls[0][0].data.targetId).toBe('new-doc');
  });

  it('reports failed document syncs without creating verification records', async () => {
    prisma.kycSession.findFirst = jest.fn().mockResolvedValue({ environment: 'live', providerId: 'provider', expiresAt: new Date(Date.now() + 60000) });
    prisma.kycSession.update = jest.fn();
    prisma.$transaction = jest.fn();
    sandbox.call.mockResolvedValue({ status: 'succeeded' });
    jest.spyOn(service, 'original').mockRejectedValue(new Error('Original file unavailable'));
    const controller = new KycController(prisma, sandbox, service);
    jest.spyOn(controller, 'status').mockResolvedValue({} as any);
    const result = await controller.sync({ user: { id: 'owner' } }, 'session');
    expect(result.syncResults).toEqual([
      { kind: 'AADHAAR', state: 'FAILED', message: 'Original file unavailable' },
      { kind: 'DL', state: 'FAILED', message: 'Original file unavailable' },
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([null, { createdAt: new Date(0) }])('blocks approval without evidence retrieved after the record changed: %p', async viewed => {
    prisma.document.findUnique.mockResolvedValue({ ...doc, kind: 'AADHAAR', updatedAt: new Date() });
    prisma.auditLog.findFirst = jest.fn().mockResolvedValue(viewed);
    prisma.document.update = jest.fn();
    prisma.$transaction = callback => callback(prisma);
    await expect(new AdminController(prisma, service).review({ user: { id: 'admin', role: 'ADMIN' } }, 'doc', {
      status: 'APPROVED', note: 'Inspected identity', identityChecked: true,
    })).rejects.toThrow('Retrieve and inspect');
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('labels uploaded images separately without invented issuer or verification claims', async () => {
    prisma.media.findFirst.mockResolvedValue({ id: 'scan', mimeType: 'image/jpeg' });
    expect(await service.original({ ...doc, source: 'UPLOAD', providerSessionId: null, mediaId: 'scan' })).toEqual({
      source: 'UPLOAD', files: [{ url: '/api/media/scan', metadata: { description: 'DL — uploaded image', ContentType: 'image/jpeg' } }],
    });
    expect(prisma.media.findFirst).toHaveBeenCalledWith({ where: { id: 'scan', ownerId: 'owner', kind: 'DL' } });
    expect(sandbox.call).not.toHaveBeenCalled();
  });

  it('fails clearly for a record without any evidence', async () => {
    await expect(service.original({ ...doc, source: 'UPLOAD', providerSessionId: null })).rejects.toThrow('No provider file or uploaded image');
  });

  it('keeps customer evidence and old certificate links scoped to their owner', async () => {
    const controller = new KycController(prisma, sandbox, service);
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(controller.evidence({ user: { id: 'other' } }, 'doc')).rejects.toThrow('Document not found');
    expect(prisma.document.findFirst).toHaveBeenCalledWith({ where: { id: 'doc', userId: 'other' } });
    await expect(controller.certificate({ user: { id: 'other' } }, 'doc', {} as any)).rejects.toThrow('Document not found');
    expect(sandbox.call).not.toHaveBeenCalled();
  });

  it('redirects old customer certificate links to the actual provider file', async () => {
    prisma.document.findFirst.mockResolvedValue(doc);
    sandbox.call.mockResolvedValue({ files: [{ url: 'https://issuer.example/dl.xml?signature=exact' }] });
    const response: any = { setHeader: jest.fn(), redirect: jest.fn(), send: jest.fn() };
    await new KycController(prisma, sandbox, service).certificate({ user: { id: 'owner' } }, 'doc', response);
    expect(response.redirect).toHaveBeenCalledWith(303, 'https://issuer.example/dl.xml?signature=exact');
    expect(response.send).not.toHaveBeenCalled();
  });

  it('rejects non-admin access to evidence and legacy certificates', async () => {
    const controller = new AdminController(prisma, service);
    await expect(controller.evidence({ user: { id: 'owner', role: 'CUSTOMER' } }, 'doc')).rejects.toThrow('Administrator access required');
    await expect(controller.certificate({ user: { id: 'owner', role: 'CUSTOMER' } }, 'doc', {} as any)).rejects.toThrow('Administrator access required');
    expect(prisma.document.findUnique).not.toHaveBeenCalled();
  });

  it('audits successful admin reads and redirects legacy admin links', async () => {
    prisma.document.findUnique.mockResolvedValue(doc);
    sandbox.call.mockResolvedValue({ files: [{ url: 'https://issuer.example/dl.pdf' }] });
    const response: any = { setHeader: jest.fn(), redirect: jest.fn() };
    await new AdminController(prisma, service).certificate({ user: { id: 'admin', role: 'ADMIN' } }, 'doc', response);
    expect(response.redirect).toHaveBeenCalledWith(303, 'https://issuer.example/dl.pdf');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: { actorId: 'admin', action: 'DOCUMENT_VIEWED', targetId: 'doc', detail: 'DL' } });
  });
});
