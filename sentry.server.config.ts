import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    debug: false,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.query_string;
        delete event.request.cookies;
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs
          .filter(b => b.category !== "console")
          .map(b => {
            if (b.category === "fetch" || b.category === "xhr") {
              return { ...b, data: undefined };
            }
            return b;
          });
      }
      return event;
    },
  });
}
