// On-chain payment verification utilities
// Verifies that transactions are real and match expected parameters

/**
 * Verify an Ethereum transaction on-chain
 * @param {string} txHash - Transaction hash
 * @param {string} expectedRecipient - Expected recipient address
 * @param {string} expectedAmount - Expected amount in wei (as string)
 * @param {number} maxAgeMs - Maximum age of transaction in milliseconds (default: 1 hour)
 * @returns {Promise<{ valid: boolean, error?: string, details?: object }>}
 */
export async function verifyEthereumTransaction(txHash, expectedRecipient, expectedAmount, maxAgeMs = 60 * 60 * 1000) {
  // Validate inputs
  if (!txHash || !isValidTxHash(txHash)) {
    return { valid: false, error: 'Invalid transaction hash format' };
  }

  if (!expectedRecipient || !isValidEthereumAddress(expectedRecipient)) {
    return { valid: false, error: 'Invalid recipient address' };
  }

  try {
    // Use public Base RPC endpoint (since this is on Base network based on contract addresses)
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

    // Get transaction receipt
    const receiptResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });

    const receiptData = await receiptResponse.json();

    if (receiptData.error) {
      return { valid: false, error: `RPC error: ${receiptData.error.message}` };
    }

    const receipt = receiptData.result;

    if (!receipt) {
      return { valid: false, error: 'Transaction not found on-chain' };
    }

    // Check if transaction was successful
    if (receipt.status !== '0x1') {
      return { valid: false, error: 'Transaction failed on-chain' };
    }

    // Get full transaction details
    const txResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getTransactionByHash',
        params: [txHash],
      }),
    });

    const txData = await txResponse.json();
    const transaction = txData.result;

    if (!transaction) {
      return { valid: false, error: 'Transaction details not found' };
    }

    // Verify recipient address (case-insensitive)
    if (transaction.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
      return {
        valid: false,
        error: `Payment sent to wrong address. Expected ${expectedRecipient}, got ${transaction.to}`,
      };
    }

    // Verify amount (convert hex to decimal for comparison)
    const actualAmount = BigInt(transaction.value);
    const expectedAmountBigInt = BigInt(expectedAmount);

    if (actualAmount < expectedAmountBigInt) {
      return {
        valid: false,
        error: `Insufficient payment amount. Expected ${expectedAmount} wei, got ${transaction.value}`,
      };
    }

    // Check transaction age
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'eth_getBlockByNumber',
        params: [receipt.blockNumber, false],
      }),
    });

    const blockData = await blockResponse.json();
    const block = blockData.result;

    if (block) {
      const blockTimestamp = parseInt(block.timestamp, 16) * 1000; // Convert to ms
      const now = Date.now();
      const age = now - blockTimestamp;

      if (age > maxAgeMs) {
        return {
          valid: false,
          error: `Transaction too old. Must be within ${maxAgeMs / 1000 / 60} minutes.`,
        };
      }
    }

    return {
      valid: true,
      details: {
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        blockNumber: receipt.blockNumber,
        transactionIndex: receipt.transactionIndex,
      },
    };

  } catch (error) {
    console.error('[PAYMENT VERIFICATION] Error:', error);
    return {
      valid: false,
      error: `Verification failed: ${error.message}`,
    };
  }
}

/**
 * Validate Ethereum address format
 * @param {string} address - Ethereum address
 * @returns {boolean}
 */
export function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  // Check if it's a valid hex string with 0x prefix and 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate transaction hash format
 * @param {string} txHash - Transaction hash
 * @returns {boolean}
 */
export function isValidTxHash(txHash) {
  if (!txHash || typeof txHash !== 'string') {
    return false;
  }
  // Check if it's a valid hex string with 0x prefix and 64 hex characters
  return /^0x[a-fA-F0-9]{64}$/.test(txHash);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
