const apiKey = 'key_live_40d7a9a8cbaf49f7b9e6cc9adcf3d3b7';
const apiSecret = 'secret_live_7d41e9090d6341e69863368632046bec';

async function test() {
  console.log('1. Authenticating...');
  const authRes = await fetch('https://api.sandbox.co.in/authenticate', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
      'x-api-version': '1.0',
      'Content-Type': 'application/json'
    }
  });
  const authData = await authRes.json();
  const token = authData.access_token || authData.data?.access_token;
  console.log('Token acquired:', token ? 'YES' : 'NO');

  console.log('2. Requesting DigiLocker session...');
  const sessionRes = await fetch('https://api.sandbox.co.in/kyc/digilocker/sessions/init', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Authorization': token,
      'x-api-version': '1.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      '@entity': 'in.co.sandbox.kyc.digilocker.session.request',
      flow: 'signin',
      redirect_url: 'http://localhost:3000/kyc.html',
      doc_types: ['aadhaar', 'driving_license']
    })
  });
  const sessionData = await sessionRes.json();
  console.log('Session response status:', sessionRes.status);
  console.log('Session response body:', JSON.stringify(sessionData, null, 2));
}

test().catch(console.error);
