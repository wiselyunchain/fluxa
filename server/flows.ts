import { getPajCashClient } from "./paj-cash";
import { getUmbraClient } from "./umbra";
import { getMagicBlockClient } from "./magic-block";
import { getNearIntentClient } from "./near-intent";

export class FlowService {
  /**
   * Flow 1: Deposit NGN -> Get Private SOL/USDT
   */
  static async handleDeposit(userId: string, nairaAmount: number, userPublicKey: string) {
    console.log(`[Flow] Starting Deposit flow for user ${userId}`);
    
    // 1. Generate Stealth Address
    const umbra = getUmbraClient();
    const { stealthAddress } = await umbra.generateStealthAddress(userPublicKey);

    // 2. Initiate Paj Cash Deposit
    const pajCash = getPajCashClient();
    const depositInfo = await pajCash.initiateDeposit({
      userId,
      nairaAmount,
      stealthAddress
    });

    // 3. The rest of the flow happens asynchronously via Webhooks:
    // User pays NGN -> Paj Cash webhook confirms -> Paj Cash sends SOL/USDT to stealthAddress via Magic Block -> User claims via ZK Proof
    
    return depositInfo;
  }

  /**
   * Flow 2: Withdraw Private SOL/USDT -> Get NGN
   */
  static async handleWithdrawal(userId: string, usdtAmount: number, userBankAccount: string, bankCode: string, accountName: string, userMainAddress: string) {
    console.log(`[Flow] Starting Withdrawal flow for user ${userId}`);
    
    // 1. Initiate Paj Cash Withdrawal (Gets Paj Cash's stealth address to send funds to)
    const pajCash = getPajCashClient();
    const withdrawalInfo = await pajCash.initiateWithdrawal({
      userId,
      usdtAmount,
      userBankAccount,
      bankCode,
      accountName
    });

    // 2. Route funds privately to Paj Cash stealth address
    const magicBlock = getMagicBlockClient();
    await magicBlock.sendPrivate({
      from: userMainAddress,
      to: withdrawalInfo.stealthAddress,
      amount: usdtAmount,
      token: "USDT",
      hideAmount: true,
      hideRecipient: true,
      hideSender: true
    });

    // 3. The rest of the flow happens asynchronously via Webhooks:
    // Paj Cash receives USDT -> Converts to NGN -> Transfers to user's bank account -> Webhook confirms

    return withdrawalInfo;
  }

  /**
   * Flow 3: Swap Any Token -> Get Private Token
   */
  static async handleSwap(userId: string, fromToken: string, fromChain: string, fromAmount: number, toToken: string, toChain: string, userPublicKey: string) {
    console.log(`[Flow] Starting Swap flow for user ${userId}`);
    
    // 1. Generate Stealth Address for the destination
    const umbra = getUmbraClient();
    const { stealthAddress } = await umbra.generateStealthAddress(userPublicKey);

    // 2. Call NEAR Intent to route and convert
    const nearIntent = getNearIntentClient();
    const result = await nearIntent.convert({
      from: {
        token: fromToken,
        chain: fromChain,
        amount: fromAmount
      },
      to: {
        token: toToken,
        chain: toChain,
        address: stealthAddress
      }
    });

    // 3. User now has funds at the stealth address and can claim them via ZK Proof
    
    return result;
  }
}
