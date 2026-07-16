import { upsertUser } from './server/db';
import { sdk } from './server/_core/sdk';
import { ONE_YEAR_MS } from './shared/const';

async function main() {
  await upsertUser({
    openId: 'verify-e2e-0001',
    username: 'user_verify_',
    email: 'verify-e2e-0001@fluxa.local',
    name: 'E2E User',
    loginMethod: 'test',
    lastSignedIn: new Date()
  });

  const sessionToken = await sdk.createSessionToken('verify-e2e-0001', {
    name: 'E2E User',
    expiresInMs: ONE_YEAR_MS,
  });

  console.log("SESSION_TOKEN=" + sessionToken);
  process.exit(0);
}

main().catch(console.error);
