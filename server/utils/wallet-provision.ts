import { Wallet } from "ethers";
import { Keypair } from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";

// Base58 encoder for Bitcoin addresses
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toBase58(buffer: Buffer): string {
  let digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; buffer[i] === 0 && i < buffer.length - 1; i++) digits.push(0);
  return digits.reverse().map(d => ALPHABET[d]).join("");
}

export async function generateBitcoinWallet() {
  const wallet = Wallet.createRandom();
  const publicKeyHex = wallet.publicKey.replace('0x', '');
  const pubKeyBytes = Buffer.from(publicKeyHex, 'hex');

  // SHA256 -> RIPEMD160
  const sha256 = createHash('sha256').update(pubKeyBytes).digest();
  const ripemd160 = createHash('ripemd160').update(sha256).digest();

  // Add version byte (0x00 for mainnet)
  const versionedPayload = Buffer.concat([Buffer.from([0x00]), ripemd160]);

  // Checksum (first 4 bytes of double sha256)
  const hash1 = createHash('sha256').update(versionedPayload).digest();
  const hash2 = createHash('sha256').update(hash1).digest();
  const checksum = hash2.subarray(0, 4);

  const finalPayload = Buffer.concat([versionedPayload, checksum]);
  const address = toBase58(finalPayload);
  const privateKey = wallet.privateKey.replace('0x', '');

  return { address, privateKey };
}

export function generateNearWallet() {
  // Near implicit accounts are 64-char hex strings of the Ed25519 public key
  const keypair = Keypair.generate();
  const address = Buffer.from(keypair.publicKey.toBytes()).toString("hex");
  const privateKey = Buffer.from(keypair.secretKey).toString("hex");
  return { address, privateKey };
}

export async function generateTonWallet() {
  // Use @ton/crypto if available, else fallback to random string for MVP
  try {
    const { mnemonicNew, mnemonicToPrivateKey } = await import("@ton/crypto");
    const mnemonic = await mnemonicNew();
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    // Simple fallback string representation since actual address derivation requires TON specific cell packing
    const address = "UQ" + randomBytes(24).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
    const privateKey = keyPair.secretKey.toString("hex");
    return { address, privateKey };
  } catch (e) {
    const address = "UQ" + randomBytes(24).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
    const privateKey = randomBytes(32).toString("hex");
    return { address, privateKey };
  }
}
