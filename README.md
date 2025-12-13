# Seen. - Mini App Discovery

Helping Farcaster builders get seen.

## Farcaster Mini App Setup

### Manifest Configuration

The manifest file is located at `public/.well-known/farcaster.json`. 

**Important:** You need to sign this manifest using Farcaster Developer Tools:

1. Go to https://farcaster.xyz/~/settings/developer-tools
2. Enable Developer Mode
3. Generate and sign your manifest
4. Replace the `accountAssociation` fields in `public/.well-known/farcaster.json` with your signed values

### Embed Metadata

The `fc:miniapp` meta tag is configured in `pages/index.js`. Make sure to:
- Update image URLs to your actual hosted images
- Ensure images meet size requirements (3:2 for og-image, 200x200 for icon)
- Update the domain in all URLs

### Testing

Test your Mini App in the preview tool:
https://farcaster.xyz/~/developers/mini-apps/preview?url={your-url}
