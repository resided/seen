# Token Claim Flow - How It Works

## 📊 The Flow

```
1. You send tokens FROM clanker contract TO treasury wallet
   └─> Clanker Contract (0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07)
   └─> Treasury Wallet (0x32b907f125C4b929D5D9565FA24Bc6BF9af39fBb) ✅ YOU CONTROL THIS

2. User claims tokens
   └─> User connects wallet in miniapp
   └─> Clicks "CLAIM NOW"
   └─> Treasury wallet sends tokens TO user's wallet ✅

3. Result
   └─> User receives 80,000 $SEEN tokens in their wallet
```

## ✅ What You Need to Do

### Step 1: Fund Your Treasury Wallet
**Send tokens FROM the clanker contract TO your treasury wallet**

- **From:** Your wallet (or wherever you have $SEEN tokens)
- **To:** `0x32b907f125C4b929D5D9565FA24Bc6BF9af39fBb` (seentreasury)
- **Token:** $SEEN token (contract: `0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07`)
- **Amount:** Calculate: `80,000 tokens × number of expected claims`

**You do NOT send to a contract** - you send tokens to your treasury wallet address (a regular wallet address).

### Step 2: Verify Treasury Has Tokens
Check on BaseScan:
- Visit: https://basescan.org/address/0x32b907f125C4b929D5D9565FA24Bc6BF9af39fBb
- Look for the $SEEN token balance
- Should show balance > 0

## 🔄 How Claims Work

1. **User connects wallet** in the Farcaster miniapp
2. **User clicks "CLAIM NOW"** button
3. **System sends tokens:**
   - FROM: Treasury wallet (`0x32b907f125C4b929D5D9565FA24Bc6BF9af39fBb`)
   - TO: User's connected wallet address
   - Amount: 80,000 $SEEN tokens
4. **User receives tokens** in their wallet

## ❌ Common Misconceptions

- ❌ **"Do I send to a contract?"** - NO, send to your treasury wallet address
- ❌ **"Does the contract send tokens?"** - NO, your treasury wallet sends tokens
- ✅ **"I send tokens to my treasury wallet"** - YES, correct!
- ✅ **"Treasury wallet sends to users"** - YES, correct!

## 🎯 Summary

1. **You control:** Treasury wallet (`0x32b907f125C4b929D5D9565FA24Bc6BF9af39fBb`)
2. **You fund it:** Send $SEEN tokens to this address
3. **System uses it:** Treasury wallet automatically sends tokens to users when they claim
4. **No contract needed:** Just a regular wallet address that holds tokens
