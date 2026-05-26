import { createFileRoute, redirect } from "@tanstack/react-router";

// Al-Fath route → /verify?surah=48&from=1&to=10 এ redirect করা হয়েছে
// এখন সব verification একটি unified page-এ: /verify?surah=...&from=...&to=...
export const Route = createFileRoute("/verify-fath")({
  beforeLoad: () => {
    throw redirect({
      to: "/verify",
      search: { surah: 48, from: 1, to: 10 },
    });
  },
  component: () => null,
});
