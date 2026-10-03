export function renderDocumentCertificate(doc: {
  id: string;
  kind: string;
  status: string;
  source?: string;
  validUntil?: Date | null;
  createdAt: Date;
  mediaId?: string | null;
  user?: { firstName?: string; lastName?: string; email?: string } | null;
  vehicle?: { make?: string; model?: string; registrationNumber?: string | null } | null;
}): string {
  const holderName = [doc.user?.firstName, doc.user?.lastName].filter(Boolean).join(' ') || 'Verified Member';
  const email = doc.user?.email || 'N/A';
  const kindNames: Record<string, string> = {
    AADHAAR: 'Aadhaar Identity Card',
    DL: 'Driving Licence Certificate',
    RC: 'Certificate of Registration (RC)',
    INSURANCE: 'Comprehensive Motor Vehicle Insurance',
    PUC: 'Pollution Under Control (PUC) Certificate'
  };
  const issuers: Record<string, string> = {
    AADHAAR: 'Unique Identification Authority of India (UIDAI)',
    DL: 'Ministry of Road Transport and Highways (MoRTH)',
    RC: 'Transport Department, Government of Gujarat',
    INSURANCE: 'Insurance Regulatory and Development Authority (IRDAI)',
    PUC: 'Authorized Emission Testing Center, MoRTH'
  };
  const docTitle = kindNames[doc.kind] || (doc.kind + ' Verification Record');
  const issuer = issuers[doc.kind] || 'Government Certification Authority';
  const validDate = doc.validUntil ? new Date(doc.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Lifetime / Active';
  const verifyDate = new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const docRef = 'SAFAR-eKYC-' + doc.id.replace(/-/g, '').slice(0, 12).toUpperCase();
  const isApproved = doc.status === 'APPROVED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} · Safar Digital Vault</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --purple: #3B1259;
      --orange: #E37220;
      --ink: #110817;
      --muted: #64748B;
      --border: #E2E8F0;
      --bg: #F8FAFC;
      --good: #059669;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.5;
      padding: 32px 16px;
    }
    .toolbar {
      max-width: 820px;
      margin: 0 auto 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .toolbar .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 19px;
      color: var(--purple);
    }
    .toolbar .actions {
      display: flex;
      gap: 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      border: 1px solid var(--border);
      background: #fff;
      color: var(--ink);
      transition: all 0.15s ease;
    }
    .btn:hover { background: #f1f5f9; }
    .btn-primary {
      background: var(--purple);
      color: #fff;
      border-color: var(--purple);
    }
    .btn-primary:hover { background: #2f0e47; }
    
    .certificate-card {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      border: 2px solid #E2E8F0;
      position: relative;
      overflow: hidden;
    }
    .certificate-header {
      background: linear-gradient(135deg, #3B1259 0%, #240B36 100%);
      color: #fff;
      padding: 28px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
    }
    .certificate-header::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, #E37220, #FFB020);
    }
    .header-text h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header-text p {
      font-size: 12.5px;
      color: #D8B4E2;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }
    .seal-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      backdrop-filter: blur(8px);
      padding: 8px 14px;
      border-radius: 30px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .seal-badge svg { color: #4ADE80; }

    .certificate-body {
      padding: 36px;
    }
    .status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${isApproved ? '#ECFDF5' : '#FFFBEB'};
      border: 1px solid ${isApproved ? '#A7F3D0' : '#FDE68A'};
      padding: 14px 20px;
      border-radius: 10px;
      margin-bottom: 28px;
    }
    .status-banner .title {
      font-size: 14px;
      font-weight: 700;
      color: ${isApproved ? '#065F46' : '#92400E'};
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-banner .ref {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      color: ${isApproved ? '#047857' : '#B45309'};
      font-weight: 600;
    }

    .grid-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px 24px;
      margin-bottom: 30px;
    }
    @media (max-width: 640px) {
      .grid-info { grid-template-columns: 1fr; }
    }
    .info-item {
      border-bottom: 1px solid #F1F5F9;
      padding-bottom: 12px;
    }
    .info-label {
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .info-val {
      font-size: 15px;
      font-weight: 600;
      color: var(--ink);
    }
    .info-val.mono {
      font-family: 'JetBrains Mono', monospace;
      color: var(--purple);
    }

    .media-box {
      margin-top: 24px;
      padding: 20px;
      background: #F8FAFC;
      border-radius: 12px;
      border: 1px solid var(--border);
      text-align: center;
    }
    .media-box img {
      max-height: 480px;
      max-width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.08);
      border: 1px solid #E2E8F0;
      object-fit: contain;
    }

    .qr-footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }
    .qr-meta {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;
    }
    .qr-meta strong {
      color: var(--ink);
    }

    @media print {
      body { padding: 0; background: #fff; }
      .toolbar { display: none; }
      .certificate-card { box-shadow: none; border: 1px solid #ccc; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="brand">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
      Safar Secure Verification Vault
    </div>
    <div class="actions">
      <button class="btn" onclick="window.close()">Close Window</button>
      <button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button>
    </div>
  </div>

  <div class="certificate-card">
    <div class="certificate-header">
      <div class="header-text">
        <h1>${docTitle}</h1>
        <p>National e-Governance &amp; DigiLocker Authenticated Record</p>
      </div>
      <div class="seal-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        DIGITALLY AUTHENTICATED
      </div>
    </div>

    <div class="certificate-body">
      <div class="status-banner">
        <div class="title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          Status: ${isApproved ? 'VERIFIED &amp; APPROVED RECORD' : 'VERIFICATION RECORD IN VAULT'}
        </div>
        <div class="ref">${docRef}</div>
      </div>

      <div class="grid-info">
        <div class="info-item">
          <div class="info-label">Document Holder Name</div>
          <div class="info-val">${holderName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Registered Email</div>
          <div class="info-val">${email}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Issuing Authority</div>
          <div class="info-val">${issuer}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Verification Source</div>
          <div class="info-val">${doc.source === 'DIGILOCKER_LIVE' ? 'DigiLocker Government Gateway (Live)' : doc.source === 'DIGILOCKER_TEST' ? 'DigiLocker Verification Gateway' : 'Safar Document Verification Portal'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Document Kind</div>
          <div class="info-val mono">${doc.kind}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Valid Until</div>
          <div class="info-val">${validDate}</div>
        </div>
        ${doc.vehicle ? `
        <div class="info-item">
          <div class="info-label">Associated Vehicle</div>
          <div class="info-val">${doc.vehicle.make} ${doc.vehicle.model} (${doc.vehicle.registrationNumber || 'N/A'})</div>
        </div>` : ''}
        <div class="info-item">
          <div class="info-label">Verified At</div>
          <div class="info-val">${verifyDate}</div>
        </div>
      </div>

      ${doc.mediaId ? `
      <div class="media-box">
        <div style="font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:12px;letter-spacing:0.04em">Attached Document Scan</div>
        <img src="/api/media/${doc.mediaId}" alt="${docTitle}">
      </div>` : ''}

      <div class="qr-footer">
        <div class="qr-meta">
          <strong>Official e-Credential Verification</strong><br>
          This credential has been verified against national digital databases under Information Technology Act.
          Tampering with or forging this digital certificate is a punishable legal offence.<br>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px">Certificate Vault UUID: ${doc.id}</span>
        </div>
        <div>
          <!-- Visual Verification Stamp / QR -->
          <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#3B1259" stroke-width="1.5">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#F8FAFC"/>
            <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z" fill="#3B1259"/>
            <path d="M14 14h2v2h-2zm3 0h1v3h-1zm-3 3h3v1h-3z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
