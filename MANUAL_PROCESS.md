# Manual Process Confirmation

## ✅ Everything is Manual - No Automation

**Confirmed:** All processes require manual admin action. No automated systems are in place.

### Submission & Approval Process
- ✅ Submissions go to `pending` status
- ✅ Admin must manually approve/reject in admin panel
- ✅ No auto-approval based on criteria
- ✅ No webhook-based auto-approval

### Featured Project Rotation
- ✅ Featured projects are set manually by admin
- ✅ No cron jobs configured in `vercel.json`
- ✅ No automated 24-hour rotation
- ✅ Admin uses "FEATURE NOW" button to set featured project

### Project Management
- ✅ All project creation is manual via admin panel
- ✅ All project editing is manual via admin panel
- ✅ Archive/unarchive is manual via admin panel

## FID Auto-Population

When FID is provided, the system automatically fetches:
- **Builder name** (display_name or username from Neynar)
- **Follower count** (from Neynar)
- **Verified wallet address** (for tipping)
- **Profile information**

This works in:
- Admin panel create form (when FID is entered)
- Admin panel edit form (when FID is entered)
- Create project API (when builderFid is provided)
- Update project API (when builderFid is provided)

## Claim Token Configuration

**Default Amount:** 80,000 tokens

**To Change:** Update `CLAIM_TOKEN_AMOUNT` environment variable

**Required Environment Variables:**
- `CLAIM_TOKEN_CONTRACT` - ERC20 token contract address
- `TREASURY_PRIVATE_KEY` - Private key of wallet holding tokens
- `CLAIM_TOKEN_AMOUNT` - Amount per claim (default: 80000)
- `CLAIM_TOKEN_DECIMALS` - Token decimals (default: 18)
