# Vercel Environment Variables

Add these environment variables in your Vercel project settings:

## Required Variables

### Redis (Required for data persistence)
```
REDIS_URL=your_redis_connection_string
```
- Get from Vercel KV, Upstash, or your Redis provider
- Format: `redis://default:password@host:port` or `rediss://...` for SSL

### Neynar API (Required for Farcaster user data)
```
NEYNAR_API_KEY=your_neynar_api_key
```
- Get from https://neynar.com
- Used for fetching user profiles, follower counts, verified wallets

### Claim Token Configuration (Required for daily claims)
```
CLAIM_TOKEN_CONTRACT=0x...your_token_contract_address
```
- Your ERC20 token contract address on Base network

```
TREASURY_PRIVATE_KEY=0xe96171d0ed1b5d9474a2e36b9c338bbf0bc0a842d15107464bb9b9942453fc53
```
- Private key of treasury wallet (starts with 0x)
- **SECURITY:** Never commit this to git, only set in Vercel environment variables

```
CLAIM_TOKEN_AMOUNT=80000
```
- Amount of tokens to send per claim (default: 80000)
- Change this value to adjust claim amount

```
CLAIM_TOKEN_DECIMALS=18
```
- Token decimals (usually 18, default: 18)

```
TREASURY_ADDRESS=0xEa73a775fa9935E686E003ae378996972386639F
```
- Treasury wallet address (optional, used for verification)
- Default is already set in code

### Admin Panel (Optional - has defaults)
```
ADMIN_USERNAME=admin
```
- Admin panel username (default: "admin")

```
ADMIN_PASSWORD=your_secure_password
```
- Admin panel password (default: "changeme123" - **CHANGE THIS!**)

```
SESSION_SECRET=your_random_secret_key
```
- Session secret for admin cookies (default: "your-secret-key-change-this" - **CHANGE THIS!**)

## Summary

**Minimum Required:**
1. `REDIS_URL`
2. `NEYNAR_API_KEY`
3. `CLAIM_TOKEN_CONTRACT`
4. `TREASURY_PRIVATE_KEY`

**Recommended:**
5. `CLAIM_TOKEN_AMOUNT` (if you want different than 80,000)
6. `ADMIN_PASSWORD` (change from default)
7. `SESSION_SECRET` (change from default)

## How to Add in Vercel

1. Go to your project in Vercel dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable above
4. Select environment (Production, Preview, Development)
5. Click **Save**
6. Redeploy your project
