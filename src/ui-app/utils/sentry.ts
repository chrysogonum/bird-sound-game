import * as Sentry from '@sentry/react';

const SENTRY_DSN = 'https://3537776cce5db894ff33a749d1110007@o4510835658850304.ingest.us.sentry.io/4510835673530368';

export function initSentry(): void {
  if (import.meta.env.DEV) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    release: 'chipnotes@5.03',
    sampleRate: 1.0,
    tracesSampleRate: 0,
    beforeSend(event) {
      const firstException = event.exception?.values?.[0];
      const frames = firstException?.stacktrace?.frames;

      // Drop errors from browser extensions
      if (frames?.some(f => f.filename?.startsWith('chrome-extension://') || f.filename?.startsWith('moz-extension://'))) {
        return null;
      }

      // Drop browser-internal errors with no stack trace (e.g., privacy browsers like
      // DuckDuckGo throwing "invalid origin" from their tracking protection features)
      const message = firstException?.value || '';
      if ((!frames || frames.length === 0) && /^invalid origin$/i.test(message)) {
        return null;
      }

      return event;
    },
  });
}
