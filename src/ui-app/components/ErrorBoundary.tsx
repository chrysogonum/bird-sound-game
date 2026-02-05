import * as Sentry from '@sentry/react';

function ErrorFallback() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--color-background, #1A1A2E)',
      color: 'var(--color-text, #FFFFFF)',
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Something went wrong</h1>
      <p style={{
        color: 'var(--color-text-muted, #C8C8D8)',
        fontSize: '15px',
        maxWidth: '320px',
        lineHeight: 1.5,
        marginBottom: '24px',
      }}>
        An unexpected error occurred. The error has been reported automatically.
      </p>
      <button
        onClick={() => { window.location.href = import.meta.env.BASE_URL; }}
        style={{
          padding: '14px 32px',
          fontSize: '16px',
          fontWeight: 600,
          background: 'var(--color-primary, #2D5A27)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
        }}
      >
        Back to Menu
      </button>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
