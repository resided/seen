# ✅ FINAL CLAIM LOGIC VERIFICATION

## 🎯 REQUIREMENTS
- **1 claim per FID per featured project**
- **40,000 tokens per claim**
- **Resets when new featured project goes live**

---

## ✅ 1. CLAIM AMOUNT: 40,000 TOKENS

### Backend Defaults (All APIs)
- ✅ `pages/api/claim/index.js`: `baseClaimAmount: 40000`
- ✅ `pages/api/claim/preflight.js`: `baseClaimAmount: 40000`
- ✅ `pages/api/claim/reserve.js`: `baseClaimAmount: 40000`
- ✅ `pages/api/claim/status.js`: `baseClaimAmount: 40000`
- ✅ `pages/api/admin/claim-settings.js`: `baseClaimAmount: 40000`

### Calculation
```javascript
TOKEN_AMOUNT = baseClaimAmount × claimMultiplier
// Default: 40000 × 1 = 40,000 tokens
```

### Admin Panel Override
- If Redis has different value, it will use that
- **Action**: Set `baseClaimAmount: 40000` in admin panel to ensure consistency

---

## ✅ 2. MAX CLAIMS: 1 (HARDCODED)

### All APIs Hardcode maxClaims = 1
- ✅ `pages/api/claim/index.js` line 218: `const maxClaims = 1;`
- ✅ `pages/api/claim/preflight.js` line 125: `const maxClaims = 1;`
- ✅ `pages/api/claim/reserve.js` line 101: `const maxClaims = 1;`
- ✅ `pages/api/claim/status.js` line 68: `const maxClaims = 1;`

### Enforcement
- ✅ Checked in `preflight.js` before wallet popup
- ✅ Checked in `reserve.js` before reservation
- ✅ Checked in `claim/index.js` before processing
- ✅ Tracked in `status.js` for UI display

### Claim Keys (Per Featured Project)
```javascript
// FID-based tracking
claimCountKey = `claim:count:${featuredProjectId}:${rotationId}:${fid}`

// Wallet-based tracking (security)
globalWalletClaimCountKey = `claim:wallet:global:${featuredProjectId}:${rotationId}:${walletAddress}`
```

---

## ✅ 3. RESET LOGIC: New Featured Project

### Rotation ID System
- `rotationId` only changes when:
  1. ✅ New project is featured (automatic)
  2. ✅ Admin clicks "Reset Claims" (manual)
- `rotationId` does NOT change when:
  - ❌ Timer is extended (1H, 6H, 12H, 24H, 11:59PM buttons)
  - ❌ Project stats are updated
  - ❌ Project is edited

### Reset Behavior
When new featured project goes live:
1. ✅ New `rotationId` is generated
2. ✅ All claim keys use new `rotationId`
3. ✅ Previous claims are no longer checked (old keys)
4. ✅ Everyone can claim again (new rotation = fresh start)

---

## ✅ 4. COMPLETE CLAIM FLOW

### Step 1: Preflight Check (`/api/claim/preflight`)
- ✅ Checks `claimsEnabled` (blocks if disabled)
- ✅ Checks featured project exists
- ✅ Checks expiration (24h window)
- ✅ Checks `maxClaims = 1` (hardcoded)
- ✅ Checks current claim count
- ✅ Checks Neynar score (≥ 0.6)
- ✅ Checks account age (≥ 2 days)
- ✅ Checks FID blocking
- **Returns**: `canClaim: true/false`

### Step 2: Reserve Slot (`/api/claim/reserve`)
- ✅ Checks `claimsEnabled`
- ✅ Checks FID blocking
- ✅ Checks featured project exists
- ✅ Checks expiration
- ✅ Checks `maxClaims = 1` (hardcoded)
- ✅ Checks current claim count
- ✅ Atomically reserves slot (prevents race conditions)
- ✅ Creates reservation with 2-minute TTL
- **Returns**: `reservationId`

### Step 3: User Signs Transaction
- ✅ User signs 0 ETH transaction to treasury
- ✅ Transaction hash is captured
- ✅ Frontend waits for confirmation

### Step 4: Process Claim (`/api/claim`)
- ✅ Validates reservation (if provided)
- ✅ Checks `claimsEnabled`
- ✅ Checks FID blocking
- ✅ Verifies transaction (if `REQUIRE_USER_TX`)
- ✅ Acquires claim lock (prevents concurrent claims)
- ✅ Increments claim counters atomically
- ✅ Checks `maxClaims = 1` (hardcoded)
- ✅ Sends 40,000 tokens (baseClaimAmount × multiplier)
- ✅ Sends bonus token (if configured)
- ✅ Clears reservation on success
- ✅ Releases lock
- **Returns**: Success with claim details

---

## ✅ 5. SECURITY CHECKS

### FID-Based Tracking
- ✅ `claim:count:${projectId}:${rotationId}:${fid}` - Tracks per FID
- ✅ Prevents FID spoofing

### Wallet-Based Tracking
- ✅ `claim:wallet:global:${projectId}:${rotationId}:${wallet}` - Tracks per wallet
- ✅ Prevents wallet rotation exploits

### Claim Lock
- ✅ `claim:lock:${wallet}` - Prevents concurrent claims
- ✅ 30-second TTL (auto-expires)

### Reservation System
- ✅ `claim:reservation:${wallet}` - Atomically reserves slot
- ✅ 2-minute TTL (expires if not used)
- ✅ Cleared on success or failure

### Transaction Hash Lock
- ✅ `claim:txhash:${txHash}` - Prevents replay attacks
- ✅ Permanent (never expires)

---

## ✅ 6. EDGE CASES HANDLED

### Claim Fails After Transaction
- ✅ Reservation is cleared
- ✅ Claim counters are rolled back
- ✅ Lock is released
- ✅ User can retry

### Multiple Simultaneous Requests
- ✅ Claim lock prevents concurrent processing
- ✅ Reservation system prevents double-booking
- ✅ Atomic increments prevent race conditions

### Timer Extension
- ✅ Does NOT reset claims
- ✅ `rotationId` stays the same
- ✅ Claim keys remain valid

### New Featured Project
- ✅ New `rotationId` generated
- ✅ All users can claim again
- ✅ Old claims are preserved (different keys)

---

## ✅ 7. VERIFICATION CHECKLIST

- [x] **Claim Amount**: 40,000 tokens (all APIs default to 40000)
- [x] **Max Claims**: 1 (hardcoded in all APIs)
- [x] **Reset Logic**: New featured project = new rotation = fresh claims
- [x] **Security**: FID + wallet tracking, locks, reservations
- [x] **Error Handling**: Reservations cleared on failure
- [x] **Consistency**: All APIs use same keys and logic

---

## 🎯 CONCLUSION

**✅ YES, IT WILL WORK!**

The system is correctly configured for:
- **1 claim per FID per featured project**
- **40,000 tokens per claim**
- **Automatic reset on new featured project**

All logic is hardcoded and consistent across all APIs. The only variable is the claim amount, which defaults to 40,000 but can be overridden in the admin panel (make sure it's set to 40,000).

