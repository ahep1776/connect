import { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname; // e.g., "/facebook"

  // Map paths to their destination URLs
  const destinations: Record<string, string> = {
    "/facebook": "https://www.facebook.com/profile.php?id=100093902866584",
    "/instagram": "https://www.instagram.com/ahep1776/",
  };

  const targetUrl = destinations[path];

  if (targetUrl) {
    // Fire-and-forget background call to GA4 via Measurement Protocol
    const GA_MEASUREMENT_ID = Deno.env.get("GA_MEASUREMENT_ID");
    const GA_API_SECRET = Deno.env.get("GA_API_SECRET");

    // Grab user demographic metadata provided natively by Netlify's CDN edge
    const userIP = context.ip;
    const userAgent = request.headers.get("user-agent") || "Unknown Device";
    const userCountry = context.geo?.country?.name || "Unknown Country";
    const userRegion = context.geo?.subdivision?.name || "Unknown Region"; // e.g. "Virginia"
    const userCity = context.geo?.city || "Unknown City";
    
    if (GA_MEASUREMENT_ID && GA_API_SECRET) {
      const gaPayload = {
        client_id: "edge_" + crypto.randomUUID(),
        // 1. Pass the user_agent and ip_address parameters at the top level
        user_agent: userAgent, 
        ip_address: userIP,
        events: [{
          name: "qr_scan",
          params: {
            social_platform: path.substring(1),
            engagement_medium: "qr_code",
            campaign: "social-connect-2026",
            // 2. Pass geographical data as custom event parameters
            scan_country: userCountry,
            scan_region: userRegion,
            scan_city: userCity
          }
        }]
      };

      // Changing the path to /debug/mp/collect returns validation error messages
const debugResponse = await fetch(`https://www.google-analytics.com/debug/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(gaPayload),
});

const validationResult = await debugResponse.json();
console.log("GA4 Validation Engine Feedback:", JSON.stringify(validationResult, null, 2));

      
      // Do NOT await — redirect happens instantly while GA call runs in background
/*
      fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gaPayload),
        }
      ).catch((err) => console.error("GA4 logging failed", err));
      */
    }

    // Server-side redirect to the social page
    return Response.redirect(targetUrl, 302);
  }

  // Fall back to main site if path doesn't match
  return Response.redirect("https://ahep1776.org", 302);
};
