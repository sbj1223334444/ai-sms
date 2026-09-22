# AI SMS Deployment Guide

## Repository Setup

The code is ready to push to GitHub at `sbj1223334444/si-sms`.

### Step 1: Create the Repository on GitHub

1. Go to https://github.com/new
2. Set repository name: `si-sms`
3. Set description: `Air India Safety Management System (AI SMS)`
4. Choose **Public** visibility
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Step 2: Push the Code

From `/Users/sabuj.mondal/ai-sms`, run:

```bash
git push -u origin main
```

If you get authentication errors, you'll need to set up GitHub authentication:

**Option A: Personal Access Token (Recommended)**
```bash
# Generate a token at https://github.com/settings/tokens (classic token with 'repo' scope)
# Then use it as your password when prompted
git push -u origin main
```

**Option B: SSH Key**
```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: https://github.com/settings/keys
cat ~/.ssh/id_ed25519.pub
# Copy the output and add it as a new SSH key on GitHub

# Then push
git push -u origin main
```

## Vercel Deployment

### Option 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import from GitHub: Select `sbj1223334444/si-sms`
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

4. Environment Variables (click "Add" for each):
   ```
   STORAGE_DRIVER=memory
   NEXTAUTH_URL=https://your-app.vercel.app (Vercel will provide this)
   NEXTAUTH_SECRET=<generate-a-random-secret>
   ```

   To generate NEXTAUTH_SECRET, run:
   ```bash
   openssl rand -base64 32
   ```

5. Click "Deploy"

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd /Users/sabuj.mondal/ai-sms
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - What's your project's name? ai-sms
# - In which directory is your code located? ./
# - Want to override settings? No

# Add environment variables
vercel env add STORAGE_DRIVER
# Enter: memory

vercel env add NEXTAUTH_SECRET
# Enter: (paste output from: openssl rand -base64 32)

# Deploy to production
vercel --prod
```

## Environment Variables Explained

### Required Variables

- `NEXTAUTH_URL`: Your application URL (e.g., https://ai-sms.vercel.app)
- `NEXTAUTH_SECRET`: Random secret for NextAuth.js session encryption

### Storage Options

**Memory Storage (Demo Mode - Default)**
```
STORAGE_DRIVER=memory
```
- Data stored in memory only
- Resets on server restart
- Perfect for demo/testing
- No additional configuration needed

**Redis Storage (Production)**
```
STORAGE_DRIVER=redis
REDIS_URL=redis://your-redis-host:6379
```
- Persistent data storage
- Requires Redis server (e.g., Upstash, Redis Cloud)
- Recommended for production use

**GitHub Storage (Production)**
```
STORAGE_DRIVER=github
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=sbj1223334444
GITHUB_REPO=si-sms-data
GITHUB_BRANCH=main
```
- Data stored as JSON files in a GitHub repository
- Full audit trail via git commits
- Requires separate data repository

### Optional Variables

```
MAIL_FROM=safety@airindia.com
MAIL_PROVIDER=console
```

## Post-Deployment

### Demo Login Credentials

After deployment, you can login with these demo accounts:

**Email**: Any of these emails with password `airindia2026`
- admin@airindia.com (Safety Manager)
- s.rangan@airindia.com (Gatekeeper)
- p.shah@airindia.com (Investigator)
- n.kulkarni@airindia.com (Gatekeeper)
- k.menon@airindia.com (Inspector - DGCA)
- r.patel@airindia.com (Flight Ops)
- a.singh@airindia.com (Cabin Crew)
- v.kumar@airindia.com (Maintenance)
- m.desai@airindia.com (Flight Ops)
- t.reddy@airindia.com (Ground Ops)
- l.sharma@airindia.com (Flight Ops)

### SSO Integration (Future)

To enable SSO authentication:

1. Configure your identity provider (Azure AD, Okta, etc.)
2. Update environment variables:
   ```
   SSO_ENABLED=true
   SSO_PROVIDER=azure-ad
   SSO_CLIENT_ID=your-client-id
   SSO_CLIENT_SECRET=your-client-secret
   SSO_TENANT_ID=your-tenant-id
   ```
3. Update `src/lib/auth.ts` to integrate with your SSO provider

## Monitoring

After deployment, verify:

1. ✅ Application loads at your Vercel URL
2. ✅ Login works with demo credentials
3. ✅ Forms are accessible from dashboard
4. ✅ Report submission works
5. ✅ Data persists (if using Redis/GitHub storage)

## Troubleshooting

### Build Errors

If build fails, check:
- Node.js version (requires 18.x or higher)
- All dependencies installed correctly
- TypeScript compilation succeeds locally: `npm run build`

### Runtime Errors

- Check Vercel logs: https://vercel.com/dashboard → Your Project → Logs
- Verify environment variables are set correctly
- Ensure NEXTAUTH_URL matches your actual deployment URL

### Storage Issues

**Memory Storage**: Data will be lost on deployment/restart - expected behavior for demo mode

**Redis Storage**: Verify Redis URL is correct and accessible from Vercel

**GitHub Storage**: 
- Ensure personal access token has `repo` scope
- Data repository must exist and be accessible
- Check token hasn't expired

## Scaling Considerations

For production deployment beyond demo:

1. **Use persistent storage** (Redis or GitHub)
2. **Enable SSO** instead of demo password
3. **Configure email notifications** (SendGrid, AWS SES, etc.)
4. **Set up monitoring** (Sentry, LogRocket, etc.)
5. **Enable CAE integration** if required
6. **Configure custom domain** in Vercel
7. **Set up backups** for your data store

## Support

For issues:
- Check application logs in Vercel dashboard
- Review build logs for deployment errors
- Test locally first: `npm run dev`
