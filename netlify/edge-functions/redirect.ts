import { Context } from "@netlify/edge-functions";

// TODO - consider making this configurable for different environments?
const DEBUG = false;

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
      const typedArray = new Uint32Array(1);
      crypto.getRandomValues(typedArray);
      const randomSessionId = typedArray[0].toString();

      const gaPayload = {
        client_id: "edge_" + crypto.randomUUID(),
        events: [{
          name: "qr_scan",
          params: {
            social_platform: path.substring(1),
            engagement_medium: "qr_code",
            campaign: "social-qrs",
            session_id: randomSessionId,
            engagement_time_msec: "100",
            // 2. Pass geographical data as custom event parameters
            scan_country: userCountry,
            scan_region: userRegion,
            scan_city: userCity
          }
        }]
      };

      // Safely URL-encode the user agent string so it doesn't break the URL path
      const encodedUA = encodeURIComponent(userAgent);
      // Construct the destination endpoint, appending the IP and UA as URL Query Parameters
      const gaUrl = [
        `https://www.google-analytics.com${DEBUG ? '/debug' : ''}/mp/collect`,
        `?measurement_id=${GA_MEASUREMENT_ID}`,
        `&api_secret=${GA_API_SECRET}`,
        `&ip_override=${userIP}`,    // <-- This tells Google to calculate demographics from this IP
        `&user_agent=${encodedUA}`,  // <-- This tells Google what phone/browser scanned it
      ].join('');

      if (DEBUG) {
        // Changing the path to /debug/mp/collect returns validation error messages
        const debugResponse = await fetch(gaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gaPayload),
        });
        
        const validationResult = await debugResponse.json();
        console.log("GA4 Validation Engine Feedback:", JSON.stringify(validationResult, null, 2));
      } else {
        // Do NOT await — redirect happens instantly while GA call runs in background
        fetch(gaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gaPayload),
        }).catch((err) => console.error("GA4 logging failed", err));
      }
    }

    // Server-side redirect to the social page
    return Response.redirect(targetUrl, 302);
  }

  // Fall back to main site if path doesn't match
  return Response.redirect("https://ahep1776.org", 302);
};
