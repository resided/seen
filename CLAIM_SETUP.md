# Claim System Setup - Required Environment Variables

## ✅ Required for Token Claims to Work

Set these environment variables in **Vercel** → **Settings** → **Environment Variables**:

### 1. Token Contract (REQUIRED)
```
CLAIM_TOKEN_CONTRACT=0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07
```
- Your ERC20 token contract address on **Base network**
- Must be a deployed ERC20 contract
- Verify on BaseScan: https://basescan.org/address/YOUR_CONTRACT_ADDRESS

### 2. Treasury Private Key (REQUIRED)
```
TREASURY_PRIVATE_KEY=0x...your_new_private_key_here
```
- Private key of wallet holding the tokens (starts with 0x)
- **SECURITY:** Never commit to git, only set in Vercel
- This wallet must have enough tokens to distribute

### 3. Treasury Address (REQUIRED)
```
TREASURY_ADDRESS=0x...your_new_treasury_wallet_address
```
- Public address of the treasury wallet
- Must match the address derived from TREASURY_PRIVATE_KEY
- Used for verification and payment collection

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

- [ ] ERC20 token contract deployed on Base network
- [ ] Treasury wallet created with new private key
- [ ] Treasury wallet funded with tokens (enough for claims)
- [ ] `CLAIM_TOKEN_CONTRACT` set in Vercel
- [ ] `TREASURY_PRIVATE_KEY` set in Vercel (new key, not the old one!)
- [ ] `TREASURY_ADDRESS` set in Vercel (matches the new private key)
- [ ] `CLAIM_TOKEN_AMOUNT` set (optional, defaults to 80000)
- [ ] `CLAIM_TOKEN_DECIMALS` set (optional, defaults to 18)
- [ ] Vercel project redeployed after setting variables
- [ ] Test claim to verify it works

## 🔍 How to Verify

1. **Check contract exists:**
   - Visit: https://basescan.org/address/YOUR_CONTRACT_ADDRESS
   - Should show "Token" tab with contract info

2. **Check treasury balance:**
   - Visit: https://basescan.org/address/YOUR_TREASURY_ADDRESS
   - Should show token balance > 0

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
