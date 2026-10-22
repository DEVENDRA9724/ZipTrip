// Developer conveniences (on-screen OTP codes, the universal test OTP, confirming a booking without a payment gateway)
// are available only when NODE_ENV is explicitly "development" or "test". A server started without NODE_ENV (for example
// by a process manager) is treated as a real deployment, so these shortcuts are off unless someone opts in locally.
export function isLocalDevelopment(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}
