# Project Submission System

## How It Works

### 1. **Submission Flow**
- Users click "SUBMIT YOUR PROJECT" button
- Fill out the submission form with project details
- Submission is stored in `pending` status
- Admin reviews and approves submissions
- Approved projects move to `queued` status
- Featured project rotates (currently manual, can be automated)

### 2. **Data Storage**

Currently using in-memory storage in `lib/projects.js`. For production, consider:

**Option A: Vercel KV (Redis)**
```bash
npm install @vercel/kv
```
- Fast, serverless-friendly
- Good for high-traffic apps

**Option B: Supabase**
```bash
npm install @supabase/supabase-js
```
- Full database with relationships
- Built-in auth if needed

**Option C: JSON File (Simple)**
- Store in `data/projects.json`
- Git-tracked or use Vercel Blob Storage

### 3. **API Endpoints**

- `GET /api/projects` - Fetch featured + queue
- `POST /api/submit` - Submit new project

### 4. **Project Statuses**

- `pending` - Awaiting approval
- `queued` - Approved, waiting for featured slot
- `featured` - Currently featured (24h rotation)

### 5. **Automation Ideas**

**Auto-rotate Featured Project:**
```javascript
// In lib/projects.js or a cron job
export function autoRotateFeatured() {
  const queue = getQueuedProjects();
  if (queue.length > 0) {
    const next = queue[0];
    setFeaturedProject(next.id);
  }
}
```

**Vercel Cron Job:**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/rotate-featured",
    "schedule": "0 0 * * *"
  }]
}
```

**Auto-approve Submissions:**
- Auto-approve if certain criteria met (verified builder, etc.)
- Or use webhook from Farcaster to auto-approve

### 6. **Admin Panel (Future)**

Create `/admin` route to:
- View pending submissions
- Approve/reject projects
- Manually set featured project
- Edit project details

### 7. **Integration with Farcaster**

- Use Farcaster API to fetch real stats (installs, DAU)
- Auto-populate builder info from FID
- Verify builder identity

