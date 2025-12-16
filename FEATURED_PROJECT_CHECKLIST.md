# Featured Project Safety Checklist

## Before Listing a New Featured Project Tonight

### ✅ Pre-Launch Checks

1. **Verify Environment Variables** (in Vercel):
   - `CLAIMS_DISABLED=false` (claims should be enabled)
   - `ADMIN_SECRET` is set (for admin panel access)
   - `TREASURY_PRIVATE_KEY` is set (for token transfers)
   - `TREASURY_ADDRESS` matches the wallet holding tokens
   - `CLAIM_TOKEN_CONTRACT` is set correctly
   - `CLAIM_TOKEN_AMOUNT` is set (default: 80000)
   - `CLAIM_TOKEN_DECIMALS` is set (default: 18)

2. **Verify Treasury Wallet**:
   - Check that treasury wallet has enough tokens for expected claims
   - Verify treasury address matches `TREASURY_ADDRESS` env var
   - Ensure wallet has enough ETH for gas fees

3. **Test Reset Claims Button**:
   - Go to admin panel
   - Click "RESET CLAIMS" button
   - Verify it works (should reset all claim locks for current featured project)
   - This is your emergency button if something goes wrong

### 🔒 Security Protections Currently Active

The system now has **multiple layers** of protection:

1. **Wallet Lock (NX Lock)**:
   - Each wallet can only claim ONCE per featured rotation
   - Uses Redis `SET NX` (set if not exists) - atomic operation
   - Prevents multi-claim even if user closes/reopens app

2. **Global Wallet Claim Counter**:
   - Tracks total claims per wallet across ALL featured rotations
   - Hard cap: 1 claim per wallet (2 for 30M+ holders)
   - Prevents exploits from featured window resets

3. **Per-Rotation Wallet Counter**:
   - Tracks claims per wallet per featured project rotation
   - Prevents FID spoofing attacks

4. **FID Claim Counter**:
   - Tracks claims per FID per featured project rotation
   - Additional layer of protection

5. **Transaction Hash Lock**:
   - Prevents same transaction from being used twice
   - Prevents replay attacks

6. **Emergency Kill Switch**:
   - Set `CLAIMS_DISABLED=true` in Vercel env to instantly stop all claims
   - Takes effect immediately (no deploy needed)

### 🚀 Steps to Safely List New Featured Project

1. **Reset Previous Claims** (if needed):
   - Go to admin panel
   - Click "RESET CLAIMS" button
   - Confirm with "RESET"
   - This clears all locks for the previous featured project

2. **Set New Featured Project**:
   - Go to admin panel
   - Find the project you want to feature
   - Click "EDIT"
   - Change status to "featured"
   - **IMPORTANT**: The system will automatically set `featuredAt` timestamp
   - Save changes

3. **Verify Featured Project**:
   - Check that the project appears on the main page
   - Verify the countdown timer is showing
   - Check that `featuredAt` timestamp is set correctly

4. **Monitor First Few Claims**:
   - Watch the first 5-10 claims closely
   - Check Vercel logs for any errors
   - Verify tokens are being sent correctly
   - Check that wallet locks are being created

5. **Emergency Procedures** (if something goes wrong):
   - **Option 1**: Set `CLAIMS_DISABLED=true` in Vercel env (instant, no deploy)
   - **Option 2**: Click "RESET CLAIMS" in admin panel (resets locks for current rotation)
   - **Option 3**: Change featured project status to "queued" (stops new claims)

### ⚠️ Important Notes

- **DO NOT** manually edit `featuredAt` timestamp - let the system set it automatically
- **DO NOT** feature a new project without resetting claims first (if needed)
- The wallet lock system is **atomic** - once a wallet claims, it cannot claim again for that rotation
- Global wallet counter prevents cross-rotation exploits
- All protections are server-side - cannot be bypassed by frontend manipulation

### 🔍 What to Watch For

- Multiple claims from same wallet (should be blocked)
- Claims after 24-hour window (should be blocked)
- Claims without valid transaction hash (should be blocked)
- Claims from wallets that already claimed (should be blocked)

If you see any of these, use the emergency kill switch immediately!

