import { useState, useEffect } from 'react';

const CONSENT_KEY = 'chipnotes_cookie_consent';

// Load Google Analytics
function loadGoogleAnalytics() {
  if (typeof window === 'undefined') return;

  // Check if already loaded
  if (window.gtag) {
    console.log('Google Analytics already loaded');
    return;
  }

  // Load gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-MJXQZYWWZ0';
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: any[]) {
    window.dataLayer?.push(args);
  }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', 'G-MJXQZYWWZ0', {
    anonymize_ip: true, // Anonymize IPs for GDPR compliance
    cookie_flags: 'SameSite=None;Secure'
  });

  console.log('Google Analytics loaded with user consent');
}

function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(CONSENT_KEY);

    if (consent === 'accepted') {
      // User previously accepted - load GA
      loadGoogleAnalytics();
    } else if (consent === null) {
      // No choice made yet - show banner
      setShowBanner(true);
    }
    // If consent === 'declined', do nothing (don't load GA, don't show banner)
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setShowBanner(false);
    loadGoogleAnalytics();
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(26, 26, 46, 0.98)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid var(--color-primary)',
      padding: '16px',
      paddingBottom: 'calc(16px + var(--safe-area-bottom, 0px))',
      zIndex: 10000,
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Message */}
        <div style={{
          fontSize: '14px',
          lineHeight: 1.5,
          color: 'var(--color-text)',
        }}>
          <strong style={{ color: 'var(--color-accent)' }}>🍪 Cookies & Privacy</strong>
          <p style={{ margin: '8px 0 0 0', color: 'var(--color-text-muted)' }}>
            We use Google Analytics to understand how people use ChipNotes and improve the app.
            This helps us know which features are useful and which birds people practice most.
            We anonymize your IP address and don't collect personal information.
          </p>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={handleAccept}
            style={{
              flex: '1 1 auto',
              minWidth: '120px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3a7332';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-primary)';
            }}
          >
            Accept Analytics
          </button>
          <button
            onClick={handleDecline}
            style={{
              flex: '1 1 auto',
              minWidth: '120px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-surface)';
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
