# Claim System Setup - Required Environment Variables

## 📋 Setup Flow

**Important:** The token contract (clanker) is separate from your treasury wallet.

1. **Token Contract** = The $SEEN token contract (you don't control this)
2. **Treasury Wallet** = A wallet YOU create and control (this sends tokens to users)

### Setup Steps:
1. Create a new treasury wallet (generate new private key)
2. Transfer tokens FROM the clanker contract TO your treasury wallet
3. Set the treasury wallet's private key in Vercel
4. Users claim → Treasury wallet sends tokens to them

## ✅ Required for Token Claims to Work

Set these environment variables in **Vercel** → **Settings** → **Environment Variables**:

### 1. Token Contract (REQUIRED)
```
CLAIM_TOKEN_CONTRACT=0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07
```
- The $SEEN token contract address on **Base network** (clanker - you don't control this)
- This is the token that will be distributed
- Verify on BaseScan: https://basescan.org/address/YOUR_CONTRACT_ADDRESS

### 2. Treasury Private Key (REQUIRED)
```
TREASURY_PRIVATE_KEY=0x...your_new_private_key_here
```
- **Private key of YOUR treasury wallet** (starts with 0x)
- **You must create this wallet and fund it with tokens**
- **SECURITY:** Never commit to git, only set in Vercel
- This wallet must have enough tokens to distribute to users

### 3. Treasury Address (REQUIRED)
```
TREASURY_ADDRESS=0x32b907f125C4b929D5D9565FA24Bc6BF9af39fBb
```
- Public address of the treasury wallet (seentreasury)
- Must match the address derived from TREASURY_PRIVATE_KEY
- Used for verification and payment collection
- **Note:** This address is public and safe to expose (it's just a wallet address)

### 4. Token Amount (Optional - has default)
```
CLAIM_TOKEN_AMOUNT=80000
```
- Amount of tokens to send per claim (default: 80,000)
- Change this to adjust claim amount

### 5. Token Decimals (Optional - has default)
```
CLAIM_TOKEN_DECIMALS=18
```
- Token decimals (usually 18, default: 18)
- Most ERC20 tokens use 18 decimals

## 📋 Setup Checklist

### Step 1: Create Treasury Wallet
- [ ] Generate a new wallet (new private key)
- [ ] Save the private key securely
- [ ] Get the wallet's public address

### Step 2: Fund Treasury Wallet
- [ ] Transfer tokens FROM the clanker contract TO your treasury wallet
- [ ] Calculate how many tokens you need: `80,000 tokens × expected claims`
- [ ] Send tokens to your treasury wallet address
- [ ] Verify balance on BaseScan

### Step 3: Configure Vercel
- [ ] `CLAIM_TOKEN_CONTRACT` set to clanker contract address (0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07)
- [ ] `TREASURY_PRIVATE_KEY` set to your treasury wallet's private key
- [ ] `TREASURY_ADDRESS` set to your treasury wallet's public address
- [ ] `CLAIM_TOKEN_AMOUNT` set (optional, defaults to 80000)
- [ ] `CLAIM_TOKEN_DECIMALS` set (optional, defaults to 18)

### Step 4: Deploy & Test
- [ ] Vercel project redeployed after setting variables
- [ ] Test claim to verify it works
- [ ] Monitor treasury wallet balance

## 🔍 How to Verify

1. **Check token contract exists (clanker):**
   - Visit: https://basescan.org/address/0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07
   - Should show "Token" tab with contract info
   - This is the token that will be distributed

2. **Check treasury wallet balance:**
   - Visit: https://basescan.org/address/YOUR_TREASURY_ADDRESS
   - Should show token balance > 0
   - **This is the wallet that sends tokens to users when they claim**
   - Make sure it has enough tokens for expected claims

3. **Test claim:**
   - User clicks "OPEN MINI APP"
   - Claim button appears
   - User connects wallet and claims
   - Check Vercel function logs for any errors

## ⚠️ Important Notes

- **Network:** Contract must be on **Base** network, not Ethereum mainnet
- **Token Standard:** Must be ERC20 with `transfer()` function
- **Balance:** Treasury wallet must have enough tokens
- **Security:** Never commit private keys to git
- **Testing:** Test with small amounts first

## 🐛 Troubleshooting

If claims fail, check Vercel function logs for:
- "Token contract not configured" → Missing CLAIM_TOKEN_CONTRACT or TREASURY_PRIVATE_KEY
- "Insufficient token balance" → Treasury wallet needs more tokens
- "Invalid contract address" → Wrong address or contract doesn't exist
- "execution reverted" → Contract issue or not an ERC20 token
