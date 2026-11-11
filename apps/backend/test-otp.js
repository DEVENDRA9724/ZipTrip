// Quick diagnostic script to test MSG91 on the server directly
const authkey = process.env.MSG91_AUTHKEY || '582575Aq8fHyK46ad5cb73P1';
const templateId = process.env.MSG91_OTP_TEMPLATE_ID || '6ad3c91bdcafbcc55c0779c2';
const mobile = '917600647428';

console.log('Testing MSG91 OTP delivery for mobile:', mobile);
console.log('Using AuthKey:', authkey.slice(0, 6) + '...' + authkey.slice(-4));
console.log('Using Template/Widget ID:', templateId);
console.log('----------------------------------------------------');

async function test() {
  // Test 1: Widget API
  console.log('\n[1] Testing MSG91 Widget API (v5)...');
  try {
    const res1 = await fetch('https://api.msg91.com/api/v5/widget/sendOtp', {
      method: 'POST',
      headers: {
        'authkey': authkey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        widgetId: templateId,
        identifier: mobile
      })
    });
    const text1 = await res1.text();
    console.log('HTTP Status:', res1.status);
    console.log('Response Body:', text1);
  } catch (err) {
    console.error('Widget API Network Error:', err.message);
  }

  // Test 2: Classic SendOTP API
  console.log('\n[2] Testing MSG91 Classic SendOTP API (v5)...');
  try {
    const url2 = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${mobile}&otp_length=6&otp_expiry=10`;
    const res2 = await fetch(url2, {
      method: 'POST',
      headers: {
        'authkey': authkey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({})
    });
    const text2 = await res2.text();
    console.log('HTTP Status:', res2.status);
    console.log('Response Body:', text2);
  } catch (err) {
    console.error('SendOTP Network Error:', err.message);
  }

  console.log('----------------------------------------------------');
}

test();
