import { test as setup, expect, request } from '@playwright/test';
import { state, storageFile, type Role } from './support/fixtures';

// Signs each synthetic account in once through the real login endpoint and saves its session cookie, so the browser
// tests reuse sessions instead of repeatedly hitting the login rate limit.
setup('sign in each panel role', async () => {
  const { baseURL, password, users } = state();
  for (const role of Object.keys(users) as Role[]) {
    const api = await request.newContext({ baseURL });
    const res = await api.post('/api/auth/login', { data: { email: users[role].email, password } });
    expect(res.status(), `login for ${role}`).toBe(201);
    const cookies = (await api.storageState()).cookies;
    expect(cookies.some((c) => c.name === 'safar_session' && c.httpOnly)).toBe(true);
    await api.storageState({ path: storageFile(role) });
    await api.dispose();
  }
});
