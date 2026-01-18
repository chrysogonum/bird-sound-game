# ChipNotes Deployment Guide

## 🚀 Quick Deploy to chipnotes.app

### Prerequisites
- [ ] GitHub account
- [ ] Domain registrar account (for chipnotes.app)
- [ ] Node.js installed locally

### Step 1: Register chipnotes.app Domain

1. Go to one of these registrars:
   - **Namecheap**: https://www.namecheap.com
   - **Porkbun**: https://porkbun.com (usually cheapest)
   - **Google Domains**: https://domains.google

2. Search for `chipnotes.app`
3. Purchase for ~$15-20/year
4. **IMPORTANT**: .app domains require HTTPS (we'll handle this automatically)

### Step 2: Install gh-pages

From the `src/ui-app` directory:
```bash
cd src/ui-app
npm install --save-dev gh-pages
```

### Step 3: Deploy to GitHub Pages

```bash
# Build and deploy
npm run deploy
```

This will:
1. Build the production app
2. Create a `gh-pages` branch
3. Push the built files to that branch

### Step 4: Configure GitHub Pages

1. Go to your repo: https://github.com/chrysogonum/bird-sound-game
2. Click **Settings** → **Pages**
3. Under "Source", select `Deploy from a branch`
4. Choose `gh-pages` branch and `/ (root)`
5. Click Save

### Step 5: Connect Your Domain

#### In GitHub:
1. Still in Settings → Pages
2. Under "Custom domain", enter: `chipnotes.app`
3. Click Save
4. Check "Enforce HTTPS" (required for .app domains)

#### At Your Domain Registrar:
Add these DNS records:

**For apex domain (chipnotes.app):**
```
Type: A
Name: @
Value: 185.199.108.153

Type: A
Name: @
Value: 185.199.109.153

Type: A
Name: @
Value: 185.199.110.153

Type: A
Name: @
Value: 185.199.111.153
```

**For www subdomain (optional):**
```
Type: CNAME
Name: www
Value: chrysogonum.github.io
```

### Step 6: Wait for DNS Propagation

- DNS changes can take 0-48 hours to propagate
- GitHub will automatically provision SSL certificate
- Check status at: https://github.com/chrysogonum/bird-sound-game/settings/pages

### Step 7: Update for Custom Domain Builds

When building for chipnotes.app (not GitHub subdomain):
```bash
# Build for custom domain
npm run build

# Deploy
npm run deploy
```

## 🎯 Alternative: Netlify (Even Easier!)

1. Go to https://netlify.com
2. Connect your GitHub repo
3. Build settings:
   - Base directory: `src/ui-app`
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add custom domain in Netlify settings
5. Auto-deploys on every git push!

## 📱 PWA Considerations

The app is already a PWA with:
- ✅ Service worker for offline support
- ✅ Manifest for installability
- ✅ Icons for home screen
- ✅ HTTPS (required for .app domains)

Once deployed to chipnotes.app, users can:
- Install it like a native app on phones
- Use it offline after first visit
- Get a full-screen experience

## 🔧 Troubleshooting

**"Page not found" after deploy:**
- Wait 10-20 minutes for GitHub Pages to build
- Check the Actions tab for build status

**Domain not working:**
- DNS can take up to 48 hours
- Use `nslookup chipnotes.app` to check DNS
- Verify DNS records at registrar

**HTTPS not working:**
- GitHub automatically provisions Let's Encrypt cert
- Can take up to 24 hours after domain verification
- Must have correct DNS records

## 📝 Updating the App

After making changes:
```bash
cd src/ui-app
npm run deploy
```

Changes will be live at chipnotes.app in ~5 minutes!