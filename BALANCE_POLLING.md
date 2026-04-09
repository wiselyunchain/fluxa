# Background Balance Polling Service

## Overview

The FluxaX background balance polling service automatically synchronizes wallet balances from the blockchain at regular intervals. This enables real-time balance display without requiring users to manually refresh or wait for API calls.

## Features

- **Periodic Polling**: Automatically polls all wallets at configurable intervals
- **Batch Processing**: Processes wallets in batches to avoid overwhelming the blockchain RPC
- **Error Handling**: Graceful error handling with retry logic and fallback to cached balances
- **Notifications**: Optional alerts when balances change significantly
- **Multi-Chain Support**: Supports Solana, Base, BSC, TON, and Avalanche
- **Statistics Tracking**: Monitors polling performance and success rates
- **Admin Control**: tRPC procedures for starting/stopping and monitoring the service

## Architecture

### Components

1. **balance-poller.ts** - Core polling engine
   - `startBalancePolling()` - Start the background service
   - `stopBalancePolling()` - Stop the service
   - `pollAllWallets()` - Manually trigger a full poll
   - `updateSingleWallet()` - Update a specific wallet
   - `getPollingStats()` - Get service statistics

2. **balance-procedures.ts** - tRPC procedures for admin control
   - `balance.startPolling` - Start polling with custom config
   - `balance.stopPolling` - Stop the polling service
   - `balance.getStatus` - Get current status and statistics
   - `balance.triggerPoll` - Manually trigger a poll
   - `balance.updateWallet` - Update a specific wallet
   - `balance.getBalanceHistory` - Get balance change history

3. **background-services.ts** - Service initialization
   - `initializeBackgroundServices()` - Start all background services on server startup
   - `shutdownBackgroundServices()` - Gracefully shutdown on server shutdown

4. **rpc-provider.ts** - Blockchain RPC integration
   - `getWalletBalance()` - Get balance for any chain
   - `getTokenBalance()` - Get ERC20/SPL token balance
   - `getGasPrice()` - Get current gas price
   - `getTransactionStatus()` - Monitor transaction status

## Configuration

### Environment Variables

```bash
# Polling interval in milliseconds (default: 60000 = 60 seconds)
BALANCE_POLL_INTERVAL=60000

# Number of wallets to poll per batch (default: 10)
BALANCE_POLL_BATCH_SIZE=10

# Maximum retries on failure (default: 3)
BALANCE_POLL_MAX_RETRIES=3

# Delay between retries in milliseconds (default: 1000)
BALANCE_POLL_RETRY_DELAY=1000

# Enable notifications on balance changes (default: false)
BALANCE_POLL_NOTIFICATIONS=true

# Percentage change threshold to trigger notifications (default: 5%)
BALANCE_POLL_THRESHOLD=5

# Blockchain RPC endpoints (optional - uses defaults if not set)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BASE_RPC_URL=https://mainnet.base.org
BSC_RPC_URL=https://bsc-dataseed.binance.org
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
```

## Usage

### Starting the Service

The service automatically starts when the server initializes:

```typescript
import { initializeBackgroundServices } from "./background-services";

// In server startup code
await initializeBackgroundServices();
```

### Admin Control via tRPC

#### Start Polling

```typescript
const result = await trpc.balance.startPolling.mutate({
  intervalMs: 60000,
  batchSize: 10,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableNotifications: true,
  balanceChangeThreshold: 5,
});
```

#### Stop Polling

```typescript
const result = await trpc.balance.stopPolling.mutate();
```

#### Get Status

```typescript
const status = await trpc.balance.getStatus.query();
// Returns: { isActive: boolean, stats: PollingStats }
```

#### Trigger Manual Poll

```typescript
const result = await trpc.balance.triggerPoll.mutate({
  intervalMs: 60000,
  batchSize: 10,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableNotifications: false,
  balanceChangeThreshold: 5,
});
// Returns: { success: boolean, duration: number, stats: PollingStats }
```

#### Update Single Wallet

```typescript
const result = await trpc.balance.updateWallet.mutate({
  walletId: 123,
});
```

#### Get Balance History

```typescript
const history = await trpc.balance.getBalanceHistory.query({
  walletId: 123,
  limit: 10,
});
```

## Polling Statistics

The service tracks the following metrics:

```typescript
interface PollingStats {
  totalWallets: number;           // Total wallets polled
  successfulUpdates: number;      // Successfully updated
  failedUpdates: number;          // Failed updates
  totalBalanceUpdated: string;    // Sum of all balances
  lastRunTime: Date;              // Last poll timestamp
  nextRunTime: Date;              // Next scheduled poll
  averageUpdateTime: number;      // Avg time per wallet (ms)
}
```

## Error Handling

The service implements robust error handling:

1. **Network Errors**: Falls back to cached balance if RPC is unavailable
2. **Invalid Addresses**: Gracefully handles invalid wallet addresses
3. **Rate Limiting**: Implements batch processing with delays to avoid rate limits
4. **Retry Logic**: Automatically retries failed updates with exponential backoff
5. **Notifications**: Sends alerts on significant balance changes (configurable threshold)

## Performance Considerations

### Optimization Tips

1. **Batch Size**: Increase batch size for faster polling, decrease to reduce RPC load
   - Recommended: 10-50 wallets per batch
   - Trade-off: Higher batch size = faster completion but higher RPC load

2. **Polling Interval**: Balance between freshness and RPC costs
   - Recommended: 30-120 seconds
   - Too frequent: High RPC costs
   - Too infrequent: Stale balance data

3. **Notification Threshold**: Set appropriate balance change threshold
   - Recommended: 5-10% for active trading
   - Recommended: 1-2% for high-frequency monitoring

### Monitoring

Monitor the service health via statistics:

```typescript
const stats = getPollingStats();
console.log(`Success rate: ${(stats.successfulUpdates / stats.totalWallets * 100).toFixed(2)}%`);
console.log(`Avg update time: ${stats.averageUpdateTime.toFixed(2)}ms`);
```

## Database Schema

The service updates the `wallets` table with:

- `balance`: Current balance (string for precision)
- `lastBalanceUpdate`: Timestamp of last update

For production use, consider adding a separate `balance_history` table:

```sql
CREATE TABLE balance_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  walletId INT NOT NULL,
  balance DECIMAL(20, 8) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (walletId) REFERENCES wallets(id),
  INDEX (walletId, timestamp)
);
```

## Testing

Run the test suite:

```bash
pnpm test -- balance-poller.test.ts
```

Tests cover:
- Service startup and shutdown
- Configuration validation
- Statistics tracking
- Error handling
- Concurrent polling prevention

## Troubleshooting

### Service Not Starting

Check logs for initialization errors:
```bash
tail -f .manus-logs/devserver.log | grep "Balance Poller"
```

### High Failure Rate

1. Check RPC endpoint availability
2. Verify wallet addresses are valid
3. Reduce batch size to avoid rate limiting
4. Check network connectivity

### Memory Issues

1. Reduce batch size
2. Increase polling interval
3. Monitor statistics for memory leaks

### Slow Updates

1. Increase batch size
2. Check RPC endpoint performance
3. Verify network latency
4. Consider using faster RPC providers

## Production Deployment

### Recommended Settings

```bash
# Production configuration
BALANCE_POLL_INTERVAL=120000          # 2 minutes
BALANCE_POLL_BATCH_SIZE=50            # Larger batches for efficiency
BALANCE_POLL_MAX_RETRIES=5            # More retries for reliability
BALANCE_POLL_RETRY_DELAY=2000         # Longer delays between retries
BALANCE_POLL_NOTIFICATIONS=true       # Enable alerts
BALANCE_POLL_THRESHOLD=10             # 10% change threshold
```

### Monitoring Checklist

- [ ] Set up alerts for polling failures
- [ ] Monitor RPC endpoint health
- [ ] Track success rate via statistics
- [ ] Set up balance change notifications
- [ ] Monitor database growth (if using balance_history)
- [ ] Set up performance metrics dashboard

## Future Enhancements

1. **WebSocket Support**: Real-time balance updates via WebSocket
2. **Balance History**: Store historical balance data for analytics
3. **Predictive Alerts**: Alert users before balance drops below threshold
4. **Custom Polling**: Per-wallet custom polling intervals
5. **Multi-Provider Fallback**: Use multiple RPC providers for redundancy
6. **Caching Layer**: Cache RPC responses to reduce API calls
