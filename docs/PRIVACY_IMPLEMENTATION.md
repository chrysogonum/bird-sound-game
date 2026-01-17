# Privacy & Security Implementation Guide

**Last Updated:** January 17, 2026
**Author:** Claude Code (with Peter Repetti)

## Table of Contents
1. [Overview](#overview)
2. [Privacy Philosophy](#privacy-philosophy)
3. [Legal Requirements](#legal-requirements)
4. [Implementation Details](#implementation-details)
5. [Technical Decisions](#technical-decisions)
6. [User Rights](#user-rights)
7. [Future Considerations](#future-considerations)

---

## Overview

ChipNotes is a privacy-first web application. We collected **zero personal data** by default, and only collect anonymized analytics **with explicit user consent**. This document explains our privacy implementation, the regulations we comply with, and the technical decisions we made.

### Quick Summary
- **No user accounts** → No passwords, emails, or personal info collected
- **Local-first architecture** → All game data stored on device, not in cloud
- **Opt-in analytics** → Google Analytics only loads if user consents
- **Full transparency** → Users can see, control, and delete all their data
- **Privacy-enhanced analytics** → IP anonymization, no ad tracking, no cross-device tracking

---

## Privacy Philosophy

### Core Principles

1. **Privacy by Default**
   - The app works perfectly without any analytics
   - No data collection until user explicitly opts in
   - No "dark patterns" to trick users into accepting cookies

2. **Transparency Over Everything**
   - Users know exactly what we collect and why
   - No hidden tracking or sneaky data collection
   - Plain language explanations (no legalese)

3. **User Control**
   - Users can toggle analytics on/off anytime
   - Users can delete all their data with one button
   - Users can export data via browser dev tools (localStorage)

4. **Minimal Data Collection**
   - Only collect what's truly useful for improving the app
   - No names, emails, locations, or identifiable info
   - Anonymize everything we do collect

### Why This Matters

**User Trust:** Bird watchers are passionate people who care about their hobbies. Building trust means respecting privacy.

**Legal Compliance:** We want to be available globally (GDPR in EU, CCPA in California, etc.) without complex geo-blocking.

**Developer Integrity:** We're building an educational tool, not a data harvesting operation.

---

## Legal Requirements

### Regulations We Comply With

#### 1. **GDPR (General Data Protection Regulation) - EU**
**Applies to:** Anyone in the European Union

**Key Requirements:**
- ✅ Explicit consent for cookies/tracking
- ✅ Right to access data
- ✅ Right to delete data ("Right to Erasure")
- ✅ Right to data portability
- ✅ Privacy policy disclosure
- ✅ Cookie declaration
- ✅ Lawful basis for processing (consent)

**How we comply:**
- Cookie consent banner on first visit
- Privacy policy at `/privacy`
- "Reset All Progress" button deletes all data
- localStorage accessible via browser dev tools
- Analytics toggleable in Settings
- Clear cookie declaration in privacy policy

#### 2. **CCPA (California Consumer Privacy Act) - California, USA**
**Applies to:** California residents

**Key Requirements:**
- ✅ Right to know what data is collected
- ✅ Right to delete personal information
- ✅ Right to opt-out of data sales
- ✅ Privacy policy disclosure

**How we comply:**
- Privacy policy lists all data collected
- "Reset All Progress" deletes all data
- We don't sell data (not applicable)
- No personal information collected

#### 3. **COPPA (Children's Online Privacy Protection Act) - USA**
**Applies to:** Services targeting children under 13

**Key Requirements:**
- ✅ No personal info from children without parental consent
- ✅ Privacy policy explaining data practices

**How we comply:**
- We don't collect personal information at all
- No user accounts or registration
- Analytics are opt-in (parents can disable)
- Privacy policy mentions children's privacy

#### 4. **ePrivacy Directive (Cookie Law) - EU**
**Applies to:** Anyone in the EU

**Key Requirements:**
- ✅ Cookie consent before setting non-essential cookies
- ✅ Option to decline cookies
- ✅ Information about cookie purposes

**How we comply:**
- Cookie consent banner with Accept/Decline options
- Analytics cookies only set after consent
- Essential cookies (game settings) exempt
- Cookie declaration in privacy policy

---

## Implementation Details

### 1. Cookie Consent System

**File:** `src/ui-app/components/CookieConsent.tsx`

**How it works:**
1. On first visit, banner appears at bottom of screen
2. User can Accept or Decline
3. Choice saved in localStorage (`chipnotes_cookie_consent`)
4. If accepted: Google Analytics loads
5. If declined: No analytics loaded
6. User can change choice anytime in Settings

**Why this approach:**
- Simple two-button choice (no dark patterns)
- Respects user decision permanently
- No repeated nagging
- Clear language about what analytics does

### 2. Privacy Policy

**File:** `src/ui-app/screens/Privacy.tsx`

**Sections included:**
- What data we collect (local + analytics)
- How we use data (game functionality + improvement)
- Third-party services (Google Analytics, Xeno-Canto)
- User rights (access, delete, withdraw consent)
- Cookies & localStorage declaration
- Data security measures
- Children's privacy
- International compliance (GDPR/CCPA)
- Contact information

**Accessibility:**
- Linked in main menu footer
- Linked in cookie consent banner
- Route: `/privacy`

### 3. Data Deletion

**File:** `src/ui-app/screens/Settings.tsx` (lines 67-89, 213)

**What gets deleted:**
- All localStorage keys (game settings, progress, custom packs, consent choice)
- All service worker caches (audio files, spectrograms, static assets)

**Process:**
1. User clicks "Reset All Progress" in Settings
2. Confirmation dialog: "This will delete ALL your progress..."
3. If confirmed:
   - `localStorage.clear()`
   - Delete all caches via Cache API
   - Reload page to reset state
4. User starts fresh (cookie banner reappears)

**Why this approach:**
- One-button solution (user-friendly)
- Confirmation prevents accidents
- Truly deletes everything (GDPR Right to Erasure)
- No hidden data remnants

### 4. Google Analytics Configuration

**File:** `src/ui-app/components/CookieConsent.tsx` (lines 29-35)

**Privacy-enhanced settings:**
```javascript
gtag('config', 'G-MJXQZYWWZ0', {
  anonymize_ip: true,                      // Anonymize IP addresses
  cookie_flags: 'SameSite=Lax;Secure',     // No cross-site tracking
  cookie_expires: 63072000,                // 2-year max (GDPR compliant)
  allow_ad_personalization_signals: false, // No ad targeting
  allow_google_signals: false,             // No cross-device tracking
});
```

**What we track (if user consents):**
- Which features are used
- Which bird packs are popular
- Which levels are played
- App performance metrics
- General usage patterns

**What we DON'T track:**
- Names, emails, phone numbers
- Precise location (IP anonymized)
- Personal identifiable information
- Cross-site behavior
- Ad targeting data

### 5. Security Headers

**File:** `src/ui-app/index.html` (lines 15-16)

**Content Security Policy (CSP):**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com;
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: blob:;
               connect-src 'self' https://www.google-analytics.com ws: wss:;
               font-src 'self';
               media-src 'self' blob:;
               worker-src 'self' blob:;
               object-src 'none';
               base-uri 'self';" />
```

**What this does:**
- Prevents many types of XSS (cross-site scripting) attacks
- Restricts which external scripts can load
- Only allows Google Analytics (if consented)
- Blocks unauthorized data exfiltration
- Allows necessary modern JavaScript features

**Why `'unsafe-eval'` and `'unsafe-inline'`?**

These directives reduce CSP strictness but are necessary for the app to function:

- **`'unsafe-eval'`**: Required by Vite (dev mode) and PixiJS (WebGL rendering). In production, bundled code may still need this for dynamic features.
- **`'unsafe-inline'`**: Required by React for inline event handlers and dynamic styling. Modern frameworks rely on this.
- **`blob:`**: Required by PixiJS for texture generation and Service Workers for caching.
- **`ws:` / `wss:`**: Required by Vite for hot module replacement (dev mode only).

**Security trade-offs:**

❌ **Less secure than strict CSP**: Cannot prevent all inline script attacks
✅ **Still prevents**: External script injection, unauthorized domains, most common XSS vectors
✅ **Better than no CSP**: Still provides meaningful protection

**Future improvement**: A stricter CSP could be used in production builds with proper nonce/hash-based inline script allowlisting. For now, this balanced approach provides security while maintaining functionality.

**Referrer Policy:**
```html
<meta name="referrer" content="no-referrer" />
```

**What this does:**
- No referrer info sent when clicking external links
- Protects user privacy
- Prevents URL parameter leakage

---

## Technical Decisions

### Decision 1: LocalStorage vs Cloud Database

**Chose:** LocalStorage (client-side only)

**Why:**
- ✅ No server = no server-side data breaches
- ✅ No user accounts = no password leaks
- ✅ Data stays on user's device (privacy)
- ✅ Works offline (PWA)
- ✅ Simpler GDPR/CCPA compliance
- ❌ Can't sync across devices (acceptable trade-off)

**Impact:** Zero risk of user data being leaked from our servers (because we have no servers).

### Decision 2: Google Analytics vs Custom Analytics

**Chose:** Google Analytics (opt-in, privacy-enhanced)

**Why:**
- ✅ Industry standard, well-understood
- ✅ Built-in privacy features (IP anonymization)
- ✅ Free for our usage level
- ✅ Good documentation
- ✅ Familiar privacy policy language
- ❌ Google is a third party (but we mitigate with strict config)

**Alternatives considered:**
- Self-hosted analytics (Matomo, Plausible) → Too complex for a free hobby project
- No analytics at all → Can't improve app without usage data

**Mitigation:**
- Opt-in only (not default)
- Maximum privacy settings enabled
- No ad personalization or cross-device tracking
- IP anonymization

### Decision 3: Cookie Banner UX

**Chose:** Simple Accept/Decline (no "necessary cookies only" etc.)

**Why:**
- ✅ Only two choices: all or nothing
- ✅ Clearer for users
- ✅ We only use analytics (no marketing cookies, etc.)
- ✅ No dark patterns
- ❌ Less granular (but we don't need granularity)

**Impact:** Users make one clear decision, not overwhelmed with options.

### Decision 4: SameSite=Lax vs SameSite=None

**Chose:** SameSite=Lax

**Why:**
- ✅ Better privacy (cookies not sent cross-site)
- ✅ Prevents CSRF attacks
- ✅ No legitimate need for cross-site tracking
- ❌ Initial config used `SameSite=None` (fixed during privacy review)

**Impact:** Google Analytics can't track users across different websites.

### Decision 5: Centralized Privacy Policy vs Inline

**Chose:** Dedicated `/privacy` page + links everywhere

**Why:**
- ✅ Legal requirement for GDPR/CCPA
- ✅ Comprehensive disclosure in one place
- ✅ Easy to update
- ✅ Users can reference anytime
- ✅ Linked from cookie banner and footer

**Impact:** Full transparency, easily accessible.

---

## User Rights

### Right to Access
**How users exercise it:**
- All data stored in browser's localStorage (visible in dev tools)
- Chrome DevTools → Application → Local Storage → `https://yoursite.com`
- Users can see all keys and values

**What they'll see:**
```
chipnotes_cookie_consent: "accepted"
soundfield_spectrogram_mode: "full"
soundfield_scroll_speed: "0.5"
soundfield_custom_pack: "[\"NOCA\",\"CARW\",\"HOWR\"]"
...
```

### Right to Delete
**How users exercise it:**
- Settings → "Reset All Progress" button
- Confirmation dialog → Deletes everything
- Or: Clear browser data manually

**What gets deleted:**
- All localStorage
- All service worker caches
- Cookie consent choice (banner reappears)

### Right to Withdraw Consent
**How users exercise it:**
- Settings → Analytics toggle → OFF
- Requires page reload for GA to stop
- Can toggle back ON anytime

### Right to Data Portability
**How users exercise it:**
- Export via browser dev tools (localStorage)
- Copy JSON data manually
- Or: Use browser's native "Export Site Data" feature

**Format:** JSON (human-readable)

---

## Data We Collect

### Local Data (Always Stored)
**Purpose:** Game functionality

| Key | Type | Purpose |
|-----|------|---------|
| `soundfield_spectrogram_mode` | string | Visual difficulty setting (full/fading/none) |
| `soundfield_scroll_speed` | number | Tile scroll speed multiplier |
| `soundfield_high_contrast` | boolean | High contrast mode toggle |
| `soundfield_continuous_play` | boolean | Timer mode preference |
| `soundfield_custom_pack` | JSON | User's custom bird pack selections |
| `soundfield_round_results` | JSON | Last round scores (not persistent) |
| `soundfield_training_mode` | boolean | Training mode toggle |
| `chipnotes_cookie_consent` | string | Cookie consent choice (accepted/declined) |

**Storage location:** Browser's localStorage
**Retention:** Until user deletes or clears browser data
**Visibility:** User can view in browser dev tools
**Deletion:** "Reset All Progress" button or clear browser data

### Analytics Data (Only if Consented)
**Purpose:** Understand app usage, improve features

**What Google Analytics collects:**
- Anonymized page views
- Button clicks / feature usage
- Session duration
- Device type (mobile/desktop)
- Browser type
- Geographic region (country/state level, IP anonymized)
- Game events (level started, pack selected, etc.)

**What Google Analytics does NOT collect:**
- Names, emails, phone numbers
- Precise IP addresses (anonymized)
- Cross-site browsing history
- Ad targeting data
- Precise geolocation

**Storage location:** Google's servers
**Retention:** 26 months (Google default), can be shorter
**Visibility:** Aggregated in Google Analytics dashboard (not user-specific)
**Deletion:** User can opt-out in Settings; data anonymized so not tied to individual

---

## Cookie Declaration

### Essential Cookies (Always Active)
These cookies are necessary for the app to function and don't require consent.

| Name | Purpose | Expiration | Type |
|------|---------|------------|------|
| `chipnotes_cookie_consent` | Stores your cookie consent choice | 10 years | localStorage |
| `soundfield_*` | Game settings and progress | Until deleted | localStorage |

**Legal basis:** Legitimate interest (necessary for service)

### Analytics Cookies (Only if Consented)
These cookies are set only if you accept analytics.

| Name | Purpose | Expiration | Type |
|------|---------|------------|------|
| `_ga` | Google Analytics main cookie | 2 years | HTTP cookie |
| `_ga_*` | Google Analytics session cookie | 2 years | HTTP cookie |

**Legal basis:** Consent

---

## Security Measures

### 1. Client-Side Only Architecture
- No backend server = no server-side vulnerabilities
- No user database = no database breaches
- No API keys exposed (except Google Analytics ID, which is public)

### 2. HTTPS Everywhere
- All traffic encrypted via HTTPS
- Service worker requires HTTPS
- Cookies marked as `Secure` (HTTPS-only)

### 3. Content Security Policy (CSP)
- Prevents XSS attacks
- Restricts external script sources
- Blocks unauthorized data exfiltration

### 4. No Third-Party Trackers
- Only Google Analytics (opt-in)
- No Facebook Pixel, no ad networks, no affiliate trackers
- No social media widgets

### 5. Service Worker Security
- Only caches first-party content
- No cross-origin caching
- Versioned cache (easy to invalidate)

### 6. No Passwords
- No user accounts = no password breaches
- No password reset vulnerabilities
- No credential stuffing attacks

---

## Future Considerations

### If We Add User Accounts
If we ever add cloud sync or user accounts, we'd need to:
- Add email collection (with consent)
- Implement secure authentication (OAuth, passwordless, etc.)
- Add data encryption at rest
- Update privacy policy
- Add data retention policies
- Implement GDPR data export (machine-readable format)
- Add account deletion flow
- Consider GDPR Data Protection Impact Assessment (DPIA)

### If We Add Social Features
If we add leaderboards, sharing, or social features:
- Add username/display name handling
- Update privacy policy for shared data
- Implement content moderation
- Add reporting/blocking features
- Consider GDPR implications of public data

### If We Expand Analytics
If we want more detailed analytics:
- Evaluate privacy-focused alternatives (Plausible, Fathom, Matomo)
- Consider self-hosted analytics
- Update privacy policy
- Add granular consent options

### If We Monetize
If we add payments or subscriptions:
- PCI-DSS compliance for payment data
- Use trusted payment processor (Stripe, PayPal)
- Update privacy policy for transaction data
- Add receipt/invoice storage

---

## Testing Privacy Implementation

### Manual Testing Checklist

**Cookie Consent:**
- [ ] Banner appears on first visit
- [ ] Accept loads Google Analytics
- [ ] Decline doesn't load Google Analytics
- [ ] Choice persists on page reload
- [ ] "Learn more" link goes to `/privacy`

**Settings:**
- [ ] Analytics toggle reflects consent state
- [ ] Toggling OFF stops analytics (after reload)
- [ ] Toggling ON loads analytics (after reload)

**Reset All Progress:**
- [ ] Confirmation dialog appears
- [ ] Cancel keeps data
- [ ] Confirm deletes all localStorage
- [ ] Confirm clears service worker caches
- [ ] Page reloads after reset
- [ ] Cookie banner reappears after reset

**Privacy Policy:**
- [ ] Accessible at `/privacy`
- [ ] All sections present
- [ ] Links work (Google Privacy Policy)
- [ ] Contact email correct
- [ ] Last updated date current

**Security Headers:**
- [ ] CSP blocks unauthorized scripts
- [ ] Referrer policy prevents leakage
- [ ] HTTPS enforced

### Browser Dev Tools Testing

**Check localStorage:**
```javascript
// Open Console in DevTools
console.log(localStorage);
// Should show all soundfield_* and chipnotes_* keys
```

**Check cookies (if analytics accepted):**
```javascript
document.cookie;
// Should show _ga and _ga_* cookies
```

**Check service worker:**
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log(registrations);
});
```

**Delete all data:**
```javascript
localStorage.clear();
caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
```

---

## Contact & Questions

**Developer:** Peter Repetti
**Email:** chipnotes.feedback@gmail.com
**Privacy Questions:** Same email
**GDPR/CCPA Requests:** Same email

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-17 | 1.0 | Initial privacy implementation | Claude Code + Peter Repetti |

---

## Appendix: Related Files

**Privacy Implementation:**
- `src/ui-app/components/CookieConsent.tsx` - Cookie consent banner
- `src/ui-app/screens/Privacy.tsx` - Privacy policy page
- `src/ui-app/screens/Settings.tsx` - Analytics toggle, data deletion
- `src/ui-app/index.html` - Security headers (CSP, referrer policy)

**Data Storage:**
- `src/ui-app/game/useGameEngine.ts` - Game state management
- `src/ui-app/screens/RoundSummary.tsx` - Round results storage
- `src/ui-app/screens/CustomPackBuilder.tsx` - Custom pack storage

**Service Worker:**
- `src/ui-app/public/sw.js` - Offline caching

**Documentation:**
- `docs/PRIVACY_IMPLEMENTATION.md` - This file
- `docs/DATA_VALIDATION.md` - Data validation system

---

## License

This privacy implementation is part of ChipNotes and follows the same license as the project.
