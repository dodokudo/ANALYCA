const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@ffprobe-installer/ffprobe"],
  outputFileTracingIncludes: {
    "/api/sync/instagram/reels": ["./node_modules/@ffprobe-installer/**/*"],
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
