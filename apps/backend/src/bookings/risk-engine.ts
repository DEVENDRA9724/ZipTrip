export interface RiskFlag {
  code: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
}

export interface RiskAssessment {
  score: number;
  level: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  autoApprove: boolean;
  flags: RiskFlag[];
  badgeText: string;
  color: string;
}

export function evaluateRisk(params: {
  customer?: any;
  vehicle?: any;
  booking?: any;
  priorIncidentsCount?: number;
}): RiskAssessment {
  const { customer, vehicle, booking, priorIncidentsCount = 0 } = params;
  const flags: RiskFlag[] = [];
  let score = 0;

  if (!customer) {
    return {
      score: 100,
      level: 'HIGH_RISK',
      autoApprove: false,
      flags: [{
        code: 'MISSING_CUSTOMER',
        severity: 'HIGH',
        title: 'Customer Identity Missing',
        description: 'Unable to resolve renter profile records.',
      }],
      badgeText: 'High Risk (Unverified)',
      color: '#EF4444',
    };
  }

  // 1. Driving License Verification & Expiry Check
  const dlValidUntil = customer.dlValidUntil || customer.profile?.dlExpiryDate;
  const isKycVerified = customer.isVerified || customer.profile?.isKycVerified;

  if (!isKycVerified) {
    score += 45;
    flags.push({
      code: 'KYC_UNVERIFIED',
      severity: 'HIGH',
      title: 'DigiLocker eKYC Incomplete',
      description: 'Customer has not completed instant DigiLocker Aadhaar & Driving Licence verification.',
    });
  } else if (!dlValidUntil) {
    score += 20;
    flags.push({
      code: 'DL_EXPIRY_UNSPECIFIED',
      severity: 'MEDIUM',
      title: 'DL Expiry Date Pending',
      description: 'Driving Licence is linked but expiration date is not recorded on registry.',
    });
  } else {
    const expiry = new Date(dlValidUntil);
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    if (expiry.getTime() < now.getTime()) {
      score += 60;
      flags.push({
        code: 'RISK_EXPIRED_DL',
        severity: 'HIGH',
        title: 'Driving Licence Expired',
        description: `Driving Licence expired on ${expiry.toLocaleDateString('en-IN')}. Driving on public roads is prohibited under MVA Sec 3.`,
      });
    } else if (expiry.getTime() < oneYearFromNow.getTime()) {
      score += 25;
      flags.push({
        code: 'RISK_EXPIRING_DL',
        severity: 'MEDIUM',
        title: 'DL Expiring Soon (< 1 Year)',
        description: `Licence validity expires within 12 months (${expiry.toLocaleDateString('en-IN')}). Manual renewal verification recommended.`,
      });
    }
  }

  // 2. Name Mismatch Check
  const accountName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim().toLowerCase();
  const profileName = customer.profile
    ? `${customer.profile.firstName || ''} ${customer.profile.lastName || ''}`.trim().toLowerCase()
    : '';

  if (profileName && accountName && profileName !== accountName) {
    // Check simple token similarity
    const accountParts = accountName.split(/\s+/);
    const profileParts = profileName.split(/\s+/);
    const matches = accountParts.some(part => profileParts.includes(part));
    if (!matches) {
      score += 35;
      flags.push({
        code: 'NAME_MISMATCH',
        severity: 'MEDIUM',
        title: 'Identity Name Discrepancy',
        description: `Account name ("${customer.firstName} ${customer.lastName}") differs noticeably from verified identity ("${customer.profile?.firstName} ${customer.profile?.lastName}").`,
      });
    }
  }

  // 3. Under-age driver check (< 21 years old)
  // Check if profile has age or DOB
  const dob = customer.profile?.dateOfBirth ? new Date(customer.profile.dateOfBirth) : null;
  if (dob) {
    const ageDiffMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDiffMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    if (age < 21) {
      score += 50;
      flags.push({
        code: 'HIGH_RISK_UNDERAGE',
        severity: 'HIGH',
        title: 'Under-Age Driver (< 21 yrs)',
        description: `Customer is ${age} years old. Minimum policy self-drive age in Gujarat is 21.`,
      });
    } else if (age < 25 && vehicle && Number(vehicle.pricePerDay || 0) > 4000) {
      score += 15;
      flags.push({
        code: 'YOUNG_DRIVER_PREMIUM_FLEET',
        severity: 'LOW',
        title: 'Young Driver on Premium Fleet',
        description: `Driver age ${age} renting a high-tier vehicle (${vehicle.make} ${vehicle.model}). Extra security deposit advised.`,
      });
    }
  }

  // 4. Incident / Dispute Record
  if (priorIncidentsCount > 0) {
    score += 40;
    flags.push({
      code: 'PRIOR_INCIDENT_RECORD',
      severity: 'HIGH',
      title: 'Previous Dispute / Damage Report',
      description: `Customer has ${priorIncidentsCount} documented dispute, fine, or damage incident(s) on record.`,
    });
  }

  // Determine Level
  let level: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' = 'LOW_RISK';
  let badgeText = 'Low Risk (Auto-Approve)';
  let color = '#10B981'; // Green

  if (score >= 50 || flags.some(f => f.severity === 'HIGH')) {
    level = 'HIGH_RISK';
    badgeText = 'High Risk (Review Required)';
    color = '#EF4444'; // Red
  } else if (score >= 20 || flags.some(f => f.severity === 'MEDIUM')) {
    level = 'MEDIUM_RISK';
    badgeText = 'Medium Risk (Inspect Docs)';
    color = '#F59E0B'; // Amber
  }

  return {
    score: Math.min(100, score),
    level,
    autoApprove: level === 'LOW_RISK',
    flags,
    badgeText,
    color,
  };
}
