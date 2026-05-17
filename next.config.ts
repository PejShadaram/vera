import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Don't auto-instrument the Clerk middleware — it runs in Edge Runtime
  // and Sentry's instrumentation can crash there without a configured DSN.
  autoInstrumentMiddleware: false,
});
