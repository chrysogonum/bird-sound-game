 Option 1: PWA Wrapper (Easiest)

  Use a tool like Capacitor (by Ionic) or PWABuilder to wrap your existing web app in a native shell.

  Pros:
  - Minimal code changes
  - Keep single codebase
  - 1-2 days of work

  Cons:
  - Apple has been stricter about "thin" wrapper apps
  - May face App Store rejection if it's "just a website"
  - Still subject to iOS audio quirks

  ---
  Option 2: Capacitor with Native Plugins (Recommended)

  Same wrapper approach, but add native plugins for audio to solve the silent switch issue properly.

  npm install @capacitor/core @capacitor/ios
  npx cap init
  npx cap add ios

  What you'd need:
  - Apple Developer Account ($99/year)
  - Xcode on a Mac
  - Native audio plugin for proper iOS audio session handling
  - App icons, screenshots, privacy policy
  - TestFlight for beta testing

  ---
  Option 3: Full React Native Rewrite

  Rebuild using React Native or Swift/SwiftUI.

  Pros:
  - Best performance
  - Full native audio control
  - No silent switch issues

  Cons:
  - Significant rewrite (weeks of work)
  - Maintain two codebases (web + native)

  ---
  App Store Requirements

  Regardless of approach:
  - Apple Developer Account: $99/year
  - App Review: 1-7 days, may require revisions
  - Privacy Policy: Required URL
  - Content Rights: You'd need to document Xeno-canto licensing (non-commercial might be an issue if you ever monetize)
  - Age Rating: Likely 4+
  - Screenshots: Various iPhone/iPad sizes

  ---
  My Recommendation

  Capacitor is the sweet spot - you keep your React codebase, add native audio handling to fix the silent switch issue permanently, and get proper App Store distribution.

  Want me to set up Capacitor for this project?

> Tell me more about what to expect if I went the Capacitor route? What acutally happens - you install that, and boom it is done!?
  ;) 

⏺ Ha! Not quite "boom done" - here's the realistic breakdown:

  Phase 1: Initial Setup (1-2 hours)

  npm install @capacitor/core @capacitor/cli
  npx cap init "Chirp" "com.yourname.chirp"
  npm install @capacitor/ios
  npx cap add ios
  npx cap sync

  This creates an ios/ folder with an Xcode project. Your web app runs inside a WKWebView (basically Safari in a native wrapper).

  At this point: App runs, but still has the silent switch issue.

  ---
  Phase 2: Fix Audio Properly (2-4 hours)

  Install a native audio plugin or configure the audio session:

  npm install @capgo/capacitor-native-audio

  Or manually edit ios/App/App/AppDelegate.swift to set:
  AVAudioSession.sharedInstance().setCategory(.playback)

  This tells iOS "I'm a media app, ignore the silent switch" - the real fix.

  ---
  Phase 3: Xcode Configuration (2-4 hours)

  Open ios/App/App.xcworkspace in Xcode and configure:

  - Bundle ID: com.yourname.chirp
  - Signing: Link your Apple Developer account
  - App Icons: Need 10+ sizes (1024x1024 down to 20x20)
  - Launch Screen: Configure or customize
  - Capabilities: Background Audio if needed
  - Info.plist: Privacy descriptions, app name

  ---
  Phase 4: Testing (1-2 days)

  1. Simulator: Test in Xcode's iPhone simulator
  2. Real Device: Plug in your iPhone, build to it
  3. TestFlight: Upload beta build, invite testers
  4. Fix the 5-10 small issues you discover (there are always some)

  ---
  Phase 5: App Store Submission (1-3 hours + waiting)

  In App Store Connect:
  - Create app listing
  - Write description, keywords
  - Upload screenshots (6.7", 6.5", 5.5" iPhones + iPad)
  - Set pricing (Free)
  - Add privacy policy URL
  - Submit for review

  Review takes: 1-7 days, often with feedback like:
  - "Please explain how you have rights to the bird sounds"
  - "Add a way to restore purchases" (even if no purchases)
  - "Guideline 4.2 - app appears to be a website wrapper"

  ---
  Realistic Timeline

  | Phase              | Time      |
  |--------------------|-----------|
  | Setup & Audio Fix  | 1 day     |
  | Xcode Config       | Half day  |
  | Testing & Fixes    | 2-3 days  |
  | App Store Assets   | Half day  |
  | Review + Revisions | 3-14 days |

  Total: 1-3 weeks from start to App Store, assuming no major rejections.

  ---
  The Gotchas

  1. "Website wrapper" rejection: Apple may reject if it looks like just a website. Adding native audio actually helps here - shows native integration.
  2. Xcode updates: Every iOS update can break things. You'll need to maintain it.
  3. Licensing: App Store = distribution = commercial? Xeno-canto NC licenses might be an issue even for a free app.
  4. Annual fee: $99/year or app disappears.