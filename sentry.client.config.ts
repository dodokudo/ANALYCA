import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://b5ba55f1244ea6b09fe2e4aaae98d34a@o4510956711444480.ingest.us.sentry.io/4510956786876416",
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
