# Fluxa Deployment Runbook

This runbook covers critical operational procedures, security guidelines, and incident response for the Fluxa platform.

## 1. Environment Variables

Ensure the following environment variables are securely provisioned in production (e.g., AWS Secrets Manager, Vercel Env, or a `.env` file):

### Core & Auth
- `VITE_APP_ID`: Application ID for OAuth and session scoping.
- `JWT_SECRET`: Used for cookie session encryption. **Must be a strong, high-entropy 256-bit key.**
- `DATABASE_URL`: Connection string to PostgreSQL instance.
- `OAUTH_SERVER_URL`: URL to the primary OAuth provider.
- `OWNER_OPEN_ID`: OpenID of the super-admin.
- `APP_BASE_URL`: The production URL (e.g., `https://fluxa.com`).

### Solana & Privacy (Umbra)
- `SOLANA_RPC_URL`: Primary RPC (e.g., Helius, Alchemy).
- `SOLANA_RPC_SUBSCRIPTIONS_URL`: WebSocket endpoint for the RPC.
- `SOLANA_NETWORK`: `mainnet-beta` or `devnet`.
- `WALLET_ENCRYPTION_KEY`: AES-256-GCM key used to encrypt user private keys at rest. **CRITICAL: If lost, all user wallets are unrecoverable. Must be backed up securely.**

### Third-Party APIs
- `PAJ_CASH_API_KEY`: API Key for Paj Cash fiat integration.
- `PAJ_CASH_ENVIRONMENT`: `Production` or `Staging`.
- `PAJ_CASH_WEBHOOK_URL`: The public webhook URL registered with Paj Cash.
- `PAJ_CASH_WEBHOOK_SECRET`: HMAC Secret used to verify incoming webhook payloads from Paj Cash.
- `NEAR_INTENT_API_KEY`: API key for NEAR Intents (Chaindefuser).

---

## 2. Key Rotation

### 2.1 Webhook Secrets (`PAJ_CASH_WEBHOOK_SECRET`)
1. Generate a new secret.
2. Update the secret in the Paj Cash dashboard.
3. Simultaneously deploy the new secret to Fluxa's production environment.
4. Monitor logs (`[PajCash webhook] Invalid signature`) to ensure incoming webhooks are still succeeding.

### 2.2 Wallet Encryption Key (`WALLET_ENCRYPTION_KEY`)
**WARNING**: Rotating this key requires a database migration script because existing wallets are encrypted with the old key.
1. Create a script that:
   a. Reads all `encryptedPrivateKey` strings from the database.
   b. Decrypts them using the `OLD_KEY`.
   c. Encrypts them using the `NEW_KEY`.
   d. Saves the new strings back to the database.
2. This must be done during scheduled downtime to avoid new wallets being created during the migration.

---

## 3. Incident Response

### 3.1 Unverified Webhook Flood (DDoS or Spam)
**Symptom**: Massive spikes in `/api/webhooks/paj-cash` traffic throwing `401 Unauthorized` errors.
**Action**:
1. Check WAF (Web Application Firewall) logs.
2. If traffic is originating from non-Paj Cash IPs, block the offending IP ranges at the CDN/WAF layer.
3. If signatures are matching but the requests are spam (replay attacks), check the request `id` in the DB to ensure idempotency.

### 3.2 Compromised Wallet Encryption Key
**Symptom**: Leak of `WALLET_ENCRYPTION_KEY` discovered.
**Action**:
1. Immediately freeze all application functionality (maintenance mode).
2. Drain affected wallets to a secure cold-storage address using an automated script if possible (requires coordinated on-chain action).
3. If funds cannot be secured, notify users immediately.
4. Rotate the key (see Key Rotation).
5. Require users to migrate funds to new wallets upon system restoration.

### 3.3 Admin Account Compromise
**Symptom**: Unauthorized freeze/unfreeze actions or viewing grant requests.
**Action**:
1. Remove the compromised user's OpenID from `OWNER_OPEN_ID` or revoke their `admin` role in the DB.
2. Check `audit_logs` in the database to review all actions taken by the compromised admin ID.
3. Revert unauthorized actions (e.g., unfreeze maliciously frozen accounts).
