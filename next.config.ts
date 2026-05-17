import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry source-map upload warnings during build when DSN is not set.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Disable automatic instrumentation tree-shaking warnings in development.
  disableLogger: true,
  // Upload source maps only when a Sentry auth token is present (CI/production).
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
