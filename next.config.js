// eslint-disable-next-line @typescript-eslint/no-require-imports -- Next.js loads this configuration as CommonJS.
const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@ffprobe-installer/ffprobe"],
  outputFileTracingIncludes: {
    "/api/sync/instagram/reels": ["./node_modules/@ffprobe-installer/**/*"],
    "/api/templates/threads": ["./lib/templates/threads-kata.html"],
  },
  turbopack: {
    root: __dirname,
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  silent: true,
  org: undefined,
  project: undefined,
});
