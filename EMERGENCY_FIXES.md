# Emergency Fix Guide - Instant Kill Switches

## ⚡ INSTANT FIXES (No Deploy Needed)

**These environment variables take effect immediately** when changed in Vercel (no redeploy required):

### 1. Disable Claims (Already Set Up)
```
CLAIMS_DISABLED=true
```
- **Location**: Vercel → Settings → Environment Variables
- **Effect**: Immediately stops all token claims
- **Use when**: Multi-claim exploit detected, need to pause claims instantly

### 2. Disable Submissions (Add This)
Add to `pages/api/submit.js`:
```javascript
if (process.env.SUBMISSIONS_DISABLED === 'true') {
  return res.status(503).json({ error: 'Submissions temporarily disabled' });
}
```
Then set:
```
SUBMISSIONS_DISABLED=true
```

### 3. Disable Payments (Add This)
Add to `pages/api/submit.js` before payment processing:
```javascript
if (process.env.PAYMENTS_DISABLED === 'true' && submissionType === 'featured') {
  return res.status(503).json({ error: 'Payment processing temporarily disabled' });
}
```
Then set:
```
PAYMENTS_DISABLED=true
```

## 🚀 Fast Deploy Optimizations

### Already Applied:
- ✅ `output: 'standalone'` - Smaller builds
- ✅ `swcMinify: true` - Faster minification
- ✅ ESLint skipped during builds
- ✅ `.vercelignore` excludes unnecessary files

### Additional Speed Tips:

1. **Use Preview Deployments for Testing**
   - Preview builds are ~30-60 seconds
   - Test fixes in preview before production

2. **Vercel Instant Rollback**
   - If a deploy breaks something, use Vercel's "Revert" button
   - Takes ~10 seconds to rollback to previous version

3. **Environment Variable Hot-Swap**
   - Change env vars in Vercel dashboard
   - Takes effect immediately (no deploy needed)
   - Perfect for kill switches

4. **Build Cache**
   - Vercel caches `node_modules` and `.next/cache`
   - Subsequent builds are faster if dependencies unchanged

## 🔥 Emergency Response Workflow

### If Exploit Detected:

1. **IMMEDIATE (0 seconds)**:
   - Go to Vercel → Settings → Environment Variables
   - Set `CLAIMS_DISABLED=true` (or relevant kill switch)
   - **No deploy needed - takes effect instantly**

2. **SHORT TERM (2 minutes)**:
   - Fix the code
   - Push to main branch
   - Vercel auto-deploys
   - Set kill switch back to `false` after deploy completes

3. **VERIFICATION**:
   - Test with a fresh wallet
   - Monitor Vercel logs
   - Watch BaseScan for unexpected transfers

## 📊 Current Build Times

- **First build**: ~1-2 minutes
- **Cached build**: ~30-60 seconds  
- **Preview build**: ~30-45 seconds
- **Env var change**: **0 seconds** (instant)

## 💡 Pro Tips

1. **Keep kill switches ready**: Have `CLAIMS_DISABLED`, `SUBMISSIONS_DISABLED`, etc. in Vercel (set to `false` normally)

2. **Use Vercel CLI for faster deploys**:
   ```bash
   vercel --prod
   ```
   Sometimes faster than waiting for GitHub webhook

3. **Monitor build logs**: Check Vercel dashboard for slow steps

4. **Split critical routes**: Move security-critical code to separate API routes that can be disabled independently

