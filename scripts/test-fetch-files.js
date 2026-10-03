const apiKey = 'key_live_40d7a9a8cbaf49f7b9e6cc9adcf3d3b7';
const apiSecret = 'secret_live_7d41e9090d6341e69863368632046bec';
const providerId = 'a0e06363-4544-4753-a936-ac47f80daa0d';

async function run() {
  const authRes = await fetch('https://api.sandbox.co.in/authenticate', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0', 'Content-Type': 'application/json' }
  });
  const authData = await authRes.json();
  const token = authData.access_token || authData.data?.access_token;

  console.log('Fetching AADHAAR document files...');
  const aadhaarRes = await fetch(`https://api.sandbox.co.in/kyc/digilocker/sessions/${providerId}/documents/aadhaar`, {
    headers: { 'x-api-key': apiKey, 'Authorization': token, 'x-api-version': '1.0' }
  });
  console.log('Aadhaar status:', aadhaarRes.status);
  const aadhaarData = await aadhaarRes.json();
  console.log('Aadhaar data:', JSON.stringify(aadhaarData, null, 2));

  console.log('Fetching DL document files...');
  const dlRes = await fetch(`https://api.sandbox.co.in/kyc/digilocker/sessions/${providerId}/documents/driving_license`, {
    headers: { 'x-api-key': apiKey, 'Authorization': token, 'x-api-version': '1.0' }
  });
  console.log('DL status:', dlRes.status);
  const dlData = await dlRes.json();
  console.log('DL data:', JSON.stringify(dlData, null, 2));
}

run().catch(console.error);
