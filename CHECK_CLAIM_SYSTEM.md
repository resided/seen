# ✅ HOW TO CHECK IF CLAIM SYSTEM IS WORKING

## 🎯 QUICK CHECKLIST

### 1. Check Admin Panel
- Go to admin panel
- Look for "CLAIM STATS" section
- Should show:
  - Total claims for current featured project
  - Claim count per user
  - If you see numbers → system is tracking claims ✅

### 2. Check Server Logs
Look for these log messages when someone claims:

**✅ SUCCESS:**
```
Valid reservation found: { reservationId: '...', walletAddress: '...', claimNum: 1, maxClaims: 1 }
Sending SEEN tokens: { tokenContract: '...', recipient: '...', amount: '40000' }
SEEN token transfer transaction sent: 0x...
Claim reservation created: { reservationId: '...', fid: ..., claimNum: 1, maxClaims: 1 }
```

**❌ ERRORS:**
```
Error processing claim (inner): { error: '...', errorName: '...', ... }
SEEN token transfer FAILED: { error: '...', ... }
```

### 3. Check Redis Keys (if you have access)
Run these commands in Redis CLI:
```bash
# Check current featured project
GET projects:featured

# Check claim settings
GET claim:settings

# Check if anyone has claimed (replace PROJECT_ID and ROTATION_ID)
KEYS claim:count:PROJECT_ID:ROTATION_ID:*
KEYS claim:wallet:global:PROJECT_ID:ROTATION_ID:*
```

### 4. Test with a Different Account
- Use a different Farcaster account (different FID)
- Try to claim
- Should work if:
  - ✅ Claims are enabled
  - ✅ Neynar score ≥ 0.6
  - ✅ Account age ≥ 2 days
  - ✅ Haven't claimed for this featured project yet

### 5. Check Error Messages
If a claim fails, you should now see:
- **Specific error message** (not just "Failed to process claim")
- **Error details** (what actually failed)
- **Error code** (for debugging)

---

## 🔍 WHAT TO LOOK FOR

### ✅ WORKING CORRECTLY:
- Users can claim once per featured project
- 40,000 tokens sent per claim
- Claims reset when new featured project goes live
- No "pending claim" errors
- Clear error messages if something fails

### ❌ NOT WORKING:
- "Failed to process claim" with no details
- Users stuck on "pending claim"
- Multiple claims for same user
- Wrong token amounts
- Claims not resetting on new featured project

---

## 🚨 IF YOU SEE ERRORS

### Check Server Logs For:
1. **Transaction validation errors**
   - `Transaction not found` → Transaction hash issue
   - `Transaction failed` → Transaction reverted on-chain
   - `Sender mismatch` → Wallet address issue

2. **Token transfer errors**
   - `SEEN token transfer FAILED` → Treasury or contract issue
   - Check treasury wallet balance
   - Check token contract address

3. **Reservation errors**
   - `Reservation expired` → Now fixed, should continue anyway
   - `Reservation not found` → Now fixed, should continue anyway

---

## 📊 ADMIN PANEL CHECKS

1. **Claim Settings**
   - Base Amount: 40,000
   - Multiplier: 1x
   - Claims Enabled: ON (green)

2. **Current Featured Project**
   - Has a featured project set
   - Has `featuredAt` timestamp
   - Has `rotationId`

3. **Claim Stats**
   - Shows total claims
   - Shows claim count per user
   - Updates when claims happen

---

## 🎯 SIMPLE TEST

1. **Set a new featured project** (if you can)
2. **Have someone else claim** (different FID)
3. **Check if they receive 40,000 tokens**
4. **Check if they can't claim again** (should show "ALREADY CLAIMED")
5. **Set another featured project**
6. **Check if they can claim again** (should work - new rotation)

If all of the above works → System is working correctly! ✅

