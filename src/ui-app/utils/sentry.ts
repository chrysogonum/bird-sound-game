import * as Sentry from '@sentry/react';

const SENTRY_DSN = 'https://3537776cce5db894ff33a749d1110007@o4510835658850304.ingest.us.sentry.io/4510835673530368';

export function initSentry(): void {
  if (import.meta.env.DEV) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    release: 'chipnotes@5.08',
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

      // Drop circular-structure errors caused by page-injected scripts that
      // monkey-patch DOM methods and JSON.stringify() the nodes passed to them.
      // Any React-managed element throws: its __reactFiber$* property points at a
      // fiber whose stateNode points back at the element. These scripts are eval'd
      // into the page context, so their frames report as <anonymous> and the
      // chrome-extension:// check above never matches them. The __reactFiber test
      // keeps this narrow — a genuine cycle in our own data would not mention it,
      // and we never stringify DOM nodes ourselves.
      if (/circular structure to JSON/i.test(message) && /__reactFiber/.test(message)) {
        return null;
      }

      return event;
    },
  });
}
