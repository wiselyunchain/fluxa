import { getDb, upsertUser } from './server/db';
import { linkedWallets, users } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import { encryptSecret } from './server/utils/wallet-crypto';
import { registerWalletOnUmbra } from './server/services/umbra';
import { Keypair } from '@solana/web3.js';

async function main() {
  await upsertUser({
    openId: 'verify-e2e-0001',
    username: 'verify-e2e-0001',
    email: 'verify-e2e-0001@example.com',
    name: 'Test User',
    loginMethod: 'test',
    lastSignedIn: new Date()
  });

  const db = await getDb();
  if (db) {
    // get user ID
    const userList = await db.select().from(users).where(eq(users.openId, 'verify-e2e-0001')).limit(1);
    const user = userList[0];
    if (user) {
      const kp = Keypair.generate();
      const encryptedPrivateKey = encryptSecret(kp.secretKey);
      
      const existing = await db
        .select()
        .from(linkedWallets)
        .where(eq(linkedWallets.userId, user.id))
        .limit(1);

      const walletData = {
        userId: user.id,
        chain: "solana" as const,
        address: kp.publicKey.toBase58(),
        privateKey: encryptedPrivateKey,
        stealthKey: encryptedPrivateKey,
        claimKey: encryptedPrivateKey,
        balance: "1000",
        isDefault: true,
      };

      let solanaWallet;
      if (existing.length > 0) {
        const updated = await db
          .update(linkedWallets)
          .set({
            address: walletData.address,
            privateKey: walletData.privateKey,
            stealthKey: walletData.stealthKey,
            claimKey: walletData.claimKey,
            balance: walletData.balance,
          })
          .where(eq(linkedWallets.id, existing[0].id))
          .returning();
        solanaWallet = updated[0];
      } else {
        const inserted = await db
          .insert(linkedWallets)
          .values(walletData)
          .returning();
        solanaWallet = inserted[0];
      }

      console.log("Registering E2E user on Umbra...");
      await registerWalletOnUmbra(solanaWallet);
    }
  }

  console.log("E2E user created and registered on Umbra");
  process.exit(0);
}

main().catch(console.error);
