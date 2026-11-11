const authkey = process.env.MSG91_AUTHKEY || '582575Aq8fHyK46ad5cb73P1';
const templateId = process.env.MSG91_OTP_TEMPLATE_ID || '6ad3c91bdcafbcc55c0779c2';
const mobile = '917600647428';

console.log('Testing MSG91 OTP delivery for mobile:', mobile);

async function test() {
  console.log('\n[1] Dispatching OTP via MSG91 SendOTP API...');
  const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${mobile}&otp_length=6&otp_expiry=10`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authkey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({})
  });
  const data = await res.json();
  console.log('Dispatch Response:', data);

  const reqId = data.request_id || '366b6b754c597a6e4a454756';
  console.log('\n[2] Checking live delivery status for requestId:', reqId);

  // Wait 2 seconds for carrier status
  await new Promise(r => setTimeout(r, 2000));

  const today = new Date().toISOString().slice(0, 10);
  const reportUrl = `https://control.msg91.com/api/v5/report/logs/p/otp?startDate=${today}&endDate=${today}&requestId=${reqId}`;
  try {
    const reportRes = await fetch(reportUrl, {
      method: 'GET',
      headers: { authkey, Accept: 'application/json' }
    });
    const reportData = await reportRes.text();
    console.log('Delivery Report:', reportData);
  } catch (err) {
    console.error('Report error:', err.message);
  }
}

test();
