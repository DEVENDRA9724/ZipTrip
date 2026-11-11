const authkey = process.env.MSG91_AUTHKEY || '582575Aq8fHyK46ad5cb73P1';
const templateId = process.env.MSG91_OTP_TEMPLATE_ID || '6ad3c91bdcafbcc55c0779c2';
const mobile = '917600647428';

async function test() {
  console.log('--- Checking MSG91 Account Balance & Credits ---');
  try {
    const balRes = await fetch(`https://control.msg91.com/api/balance.php?authkey=${authkey}&type=4`);
    const balText = await balRes.text();
    console.log('MSG91 Balance:', balText);
  } catch (e) {
    console.log('Balance check error:', e.message);
  }

  try {
    const acctRes = await fetch('https://control.msg91.com/api/v1/account', {
      headers: { authkey, Accept: 'application/json' }
    });
    const acctText = await acctRes.text();
    console.log('MSG91 Account Info:', acctText);
  } catch (e) {
    console.log('Account check error:', e.message);
  }

  console.log('\n--- Dispatching OTP via MSG91 SendOTP API ---');
  const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${mobile}&otp_length=6&otp_expiry=10`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authkey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({})
  });
  const data = await res.json();
  console.log('Dispatch Response:', data);
}

test();
