import { useNavigate } from 'react-router-dom';

function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h2 style={{ margin: 0 }}>Privacy Policy</h2>
      </div>

      <div className="flex-col gap-lg" style={{ maxWidth: '800px' }}>
        <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>Last Updated:</strong> January 25, 2026
          </p>
          <p style={{ marginBottom: '12px' }}>
            ChipNotes! is committed to protecting your privacy. This policy explains what data is collected, how it is used, and your rights.
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Data Collection</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>
              <strong>Local Data (Always Stored on Your Device):</strong>
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Game settings (scroll speed, spectrogram mode, high contrast, continuous play)</li>
              <li>Custom pack selections (bird species you choose) and saved custom packs (pack names you create, up to 10 packs)</li>
              <li>Round results and scores (not linked to your identity)</li>
              <li>Cookie consent preference</li>
            </ul>
            <p style={{ marginBottom: '8px' }}>
              <strong>Analytics Data (Only if You Consent):</strong>
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Anonymized usage data via Google Analytics (IP addresses are anonymized)</li>
              <li>Which features are used and which birds are practiced</li>
              <li>App performance metrics</li>
            </ul>
            <p style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
              <strong>Not collected:</strong> Names, email addresses, phone numbers, precise location, or any personally identifiable information. Your game data stays on your device.
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>How Your Data Is Used</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <ul style={{ marginLeft: '20px' }}>
              <li>Local data: Saves your preferences and tracks your progress</li>
              <li>Analytics data: Used to understand how many players use ChipNotes, which features are popular, and how to improve the app</li>
              <li>Your data is never sold, rented, or shared with third parties (except Google Analytics if you consent)</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Third-Party Services</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>
              <strong>Google Analytics</strong> (only if you consent)
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Used to collect anonymized usage statistics</li>
              <li>IP anonymization enabled</li>
              <li>No ad personalization or cross-device tracking</li>
              <li>Learn more: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>Google Privacy Policy</a></li>
            </ul>
            <p style={{ marginBottom: '8px' }}>
              <strong>Bird Audio</strong>
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li>Bird sound recordings are sourced from Xeno-Canto, Cornell Macaulay Library, and New Zealand Department of Conservation, and cached locally on your device</li>
              <li>No data is sent to these sources when you play sounds offline</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Your Rights</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>You have the right to:</p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li><strong>Access your data:</strong> All local data is stored in your browser's localStorage (visible in browser dev tools)</li>
              <li><strong>Delete your data:</strong> Delete individual saved custom packs using the Delete button in Custom Pack Builder, or use the "Reset All Progress" button in Settings to delete all local data and cache</li>
              <li><strong>Withdraw consent:</strong> Toggle "Analytics" in Settings to disable Google Analytics at any time</li>
              <li><strong>Data portability:</strong> Local data can be exported via browser dev tools (localStorage)</li>
            </ul>
            <p style={{ fontSize: '13px' }}>
              Since all game data is stored locally on your device, you have full control. Uninstalling the app or clearing browser data will permanently delete all your data.
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Cookies & Local Storage</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>
              <strong>Essential (Always Active):</strong>
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li><code style={{ background: 'var(--color-surface)', padding: '2px 6px', borderRadius: '4px' }}>chipnotes_cookie_consent</code> - Stores your cookie consent choice</li>
              <li><code style={{ background: 'var(--color-surface)', padding: '2px 6px', borderRadius: '4px' }}>soundfield_*</code> - Game settings and progress (all stored in localStorage)</li>
            </ul>
            <p style={{ marginBottom: '8px' }}>
              <strong>Analytics (Only if You Consent):</strong>
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li><code style={{ background: 'var(--color-surface)', padding: '2px 6px', borderRadius: '4px' }}>_ga</code>, <code style={{ background: 'var(--color-surface)', padding: '2px 6px', borderRadius: '4px' }}>_ga_*</code> - Google Analytics cookies (2-year expiration)</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Data Security</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <ul style={{ marginLeft: '20px' }}>
              <li>All data is stored locally on your device (no cloud servers)</li>
              <li>HTTPS encryption for all web traffic</li>
              <li>No user accounts or authentication (no password risks)</li>
              <li>Service Worker caches audio files for offline use (stored locally)</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Children's Privacy</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p>
              ChipNotes does not knowingly collect data from children under 13. The app does not require any personal information, and analytics are opt-in. Parents can disable analytics in Settings.
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>International Users</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>
              ChipNotes complies with:
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>GDPR</strong> (European Union) - Right to access, deletion, and data portability</li>
              <li><strong>CCPA</strong> (California) - Right to know and delete personal information</li>
              <li>Since no personal information is collected, compliance is straightforward</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Changes to This Policy</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p>
              This Privacy Policy may be updated from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the app after changes constitutes acceptance of the updated policy.
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Contact Us</h3>
          <div className="text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>
              Questions about this Privacy Policy or your data?
            </p>
            <p>
              Email:{' '}
              <a href="mailto:feedback@chipnotes.app" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                feedback@chipnotes.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default Privacy;
