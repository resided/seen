# SIMPLE CLAIM GUIDE

## How Claims Work (Simple Version)

### SEEN Tokens
- **40,000 SEEN per claim** (configurable in admin panel)
- **1 claim per person per featured project**
- Resets when you set a NEW featured project

### DONUT (Bonus Token)
- **1 DONUT per person** (max 200 total)
- First-come, first-served until 200 are given
- Each wallet can only get DONUT once per campaign
- **MUST BE CONFIGURED IN ADMIN PANEL**

---

## Admin Panel Quick Reference

### To Start a New Campaign:
1. Go to Admin Panel
2. Select/Create a project → Set as Featured
3. Configure DONUT (see below)
4. Click "RESET ALL CLAIMS" (with "Reset DONUT" checked)

### To Configure DONUT:
In Admin Panel → "BONUS TOKEN CONFIG" section:

```
Token Name: DONUT
Contract Address: 0x... (your DONUT contract)
Amount Per Claim: 1
Decimals: 18
Max Supply: 200
Enabled: ✅ (checked)
```

Click **SAVE** after entering.

### To Reset Claims (if needed):
1. Click "RESET ALL CLAIMS" button
2. Check "Reset DONUT eligibility" checkbox
3. Confirm with "RESET"
4. Wait 10 seconds for UI to update

---

## Why Some People Get DONUT and Others Don't

1. **Max supply reached** - Only 200 DONUTs available
2. **Already claimed** - Each wallet gets DONUT once
3. **Not configured** - DONUT must be enabled in admin
4. **Treasury empty** - Treasury needs DONUT tokens

### To Check Why:
Look at Vercel logs for messages like:
- "✅ Bonus token sent successfully" = Got DONUT
- "⚠️ Bonus token NOT sent" = Didn't get DONUT (logs show why)

---

## Troubleshooting

### "ALREADY CLAIMED" after reset
- Wait 10 seconds (UI polls every 10s)
- Refresh the page

### "Too many claims from this wallet"
- Click "RESET ALL CLAIMS" in admin panel
- This clears rate limits too

### DONUT not sending
1. Check DONUT is enabled in admin panel
2. Check treasury has DONUT tokens
3. Check max supply hasn't been reached
4. Check contract address is correct

### Claims not working at all
1. Check `CLAIMS_DISABLED` toggle is OFF
2. Check `CLAIM_TOKEN_CONTRACT` is set in Vercel env
3. Check `TREASURY_PRIVATE_KEY` is set in Vercel env

---

## Current Settings (Check Admin Panel)

| Setting | What It Does |
|---------|--------------|
| CLAIM_TOKEN_CONTRACT | SEEN token address |
| TREASURY_PRIVATE_KEY | Wallet that sends tokens |
| TREASURY_ADDRESS | Must match private key |
| baseClaimAmount | SEEN per claim (40000) |
| Bonus Token Config | DONUT settings |

---

## Simple Workflow

```
NEW CAMPAIGN:
1. Set featured project
2. Configure DONUT (if using)
3. Reset all claims ✅
4. Users can now claim

RESET MID-CAMPAIGN:
1. Click "Reset All Claims"
2. Check "Reset DONUT" if needed
3. Everyone can claim again
```

