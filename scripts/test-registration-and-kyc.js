const http = require('http');

async function test() {
  console.log('1. Testing registration with fresh email...');
  const regEmail = `driver_${Date.now()}@example.com`;
  const regRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Aarav',
      lastName: 'Patel',
      email: regEmail,
      password: 'StrongPassword123!',
      phone: '+919876501234',
      role: 'CUSTOMER'
    })
  });
  console.log('Registration status:', regRes.status);
  const regData = await regRes.json();
  console.log('Registration response:', regData);

  const cookie = regRes.headers.get('set-cookie');
  console.log('Session cookie received:', cookie ? 'YES' : 'NO');

  console.log('2. Fetching KYC status for new user...');
  const kycRes = await fetch('http://localhost:3000/api/kyc', {
    headers: { 'Cookie': cookie }
  });
  console.log('KYC status code:', kycRes.status);
  const kycData = await kycRes.json();
  console.log('KYC status data:', kycData);

  console.log('3. Starting DigiLocker session with Sandbox live credentials...');
  const sessionRes = await fetch('http://localhost:3000/api/kyc/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({ consent: true })
  });
  console.log('DigiLocker session status code:', sessionRes.status);
  const sessionData = await sessionRes.json();
  console.log('DigiLocker session response:', sessionData);
}

test().catch(console.error);
