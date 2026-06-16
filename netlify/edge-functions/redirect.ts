import { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname; // e.g., "/facebook"

  // Map paths to their destination URLs
  const destinations: Record<string, string> = {
    "/facebook": "https://www.facebook.com/ahep1776",
    "/instagram": "https://www.instagram.com/ahep1776",
  };

  const targetUrl = destinations[path];

  if (targetUrl) {
    // Fire-and-forget background call to GA4 via Measurement Protocol
    const GA_MEASUREMENT_ID = Deno.env.get("GA_MEASUREMENT_ID");
    const GA_API_SECRET = Deno.env.get("GA_API_SECRET");

    if (GA_MEASUREMENT_ID && GA_API_SECRET) {
      const gaPayload = {
        client_id:
          "edge_generated_" + Math.random().toString(36).substring(2, 15),
        events: [
          {
            name: "qr_scan",
            params: {
              social_platform: path.substring(1), // e.g. "facebook"
              engagement_medium: "qr_code",
              campaign: "social-connect-2026",
            },
          },
        ],
      };

      // Do NOT await — redirect happens instantly while GA call runs in background
      fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
        {
          method: "POST",
          body: JSON.stringify(gaPayload),
        }
      ).catch((err) => console.error("GA4 logging failed", err));
    }

    // Server-side redirect to the social page
    return Response.redirect(targetUrl, 302);
  }

  // Fall back to main site if path doesn't match
  return Response.redirect("https://ahep1776.org", 302);
};
