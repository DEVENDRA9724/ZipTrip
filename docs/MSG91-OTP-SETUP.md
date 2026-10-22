# MSG91 OTP login setup

The portal keeps the MSG91 auth key in the NestJS API. The browser and the mobile app call Safar's `/api/auth/login/otp/request` and `/api/auth/login/otp/verify` endpoints; neither client receives the MSG91 key.

## 1. Configure MSG91

1. Create or open an MSG91 account and enable the OTP product.
2. Complete the sender/DLT and OTP template setup required for Indian SMS delivery.
3. Copy the account auth key and the OTP template ID. The template must contain the OTP variable expected by MSG91.
4. Test one number in the MSG91 dashboard before connecting the portal.

MSG91 documents the flow as SendOTP (POST), Verify OTP (GET), and Resend OTP (GET). See the [OTP API overview](https://docs.msg91.com/otp), [SendOTP reference](https://docs.msg91.com/otp/sendotp), and [Verify OTP reference](https://docs.msg91.com/otp/verify-otp).

## 2. Add API environment variables

Set these in `apps/backend/.env` on the API server. Do not put them in `apps/web`, the mobile app, Git, or a public frontend environment.

```env
OTP_PROVIDER=msg91
MSG91_AUTHKEY=replace-with-your-msg91-auth-key
MSG91_OTP_TEMPLATE_ID=replace-with-your-otp-template-id
MSG91_OTP_SEND_URL=https://control.msg91.com/api/v5/otp
MSG91_OTP_VERIFY_URL=https://control.msg91.com/api/v5/otp/verify
MSG91_OTP_RETRY_URL=https://control.msg91.com/api/v5/otp/retry
```

The adapter accepts Indian numbers as `9876543210`, `09876543210`, or `+919876543210` and sends MSG91 the required international digits (`919876543210`).

## 3. Run and test the flow

Restart the API after changing `.env`:

```powershell
cd apps/backend
npm run build
npm run start:prod
```

Request an OTP:

```powershell
curl.exe -X POST http://localhost:3000/api/auth/login/otp/request `
  -H "Content-Type: application/json" `
  -d '{"phone":"+919876543210"}'
```

Verify it and receive the Safar JWT/cookie:

```powershell
curl.exe -X POST http://localhost:3000/api/auth/login/otp/verify `
  -H "Content-Type: application/json" `
  -d '{"phone":"+919876543210","otp":"123456"}'
```

The web sign-in page now has **Sign in with mobile OTP**. The registration flow also sends the verification OTP through MSG91 when `OTP_PROVIDER=msg91`.

## 4. Production checks

- Use HTTPS and set `WEB_ORIGIN` to the exact production origin.
- Keep the MSG91 key in AWS Secrets Manager or the server's protected environment, with no frontend exposure.
- Keep the existing API rate limit and add a shared Redis limiter before running multiple API instances.
- Never enable the local development OTP or the universal `123456` test code in production. This implementation only exposes development OTPs outside production and only when `OTP_PROVIDER` is not `msg91`.
- Monitor MSG91 delivery/failure logs and configure a resend policy after the first send; the configured resend URL is ready for a later resend button.

The alternative MSG91 OTP Widget can manage the complete client flow, but it requires a widget ID and request ID state. Safar currently uses the server-side API flow so the same login behavior works in web, Android, and iOS clients.
