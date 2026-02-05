import * as Sentry from '@sentry/react';

const SENTRY_DSN = 'https://3537776cce5db894ff33a749d1110007@o4510835658850304.ingest.us.sentry.io/4510835673530368';

export function initSentry(): void {
  if (import.meta.env.DEV) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    release: 'chipnotes@4.20',
    sampleRate: 1.0,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Drop errors from browser extensions
      const frames = event.exception?.values?.[0]?.stacktrace?.frames;
      if (frames?.some(f => f.filename?.startsWith('chrome-extension://') || f.filename?.startsWith('moz-extension://'))) {
        return null;
      }
      return event;
    },
  });
}
