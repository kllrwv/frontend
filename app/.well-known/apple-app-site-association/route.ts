export const dynamic = "force-dynamic";
export function GET() {
  const appID = process.env.KILLERWAVE_IOS_APPLICATION_IDENTIFIER?.trim() ?? "";
  if (!/^[A-Z0-9]{10}\.xyz\.killerwave\.app(?:\.[A-Za-z0-9-]+)*$/.test(appID)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({
    applinks: {
      details: [{
        appIDs: [appID],
        components: [
          { "/": "/@*/post/*" },
          { "/": "/@*/*", exclude: true },
          { "/": "/@*" },
          ...["/", "/search", "/notifications", "/privacy", "/terms", "/status"].map(path => ({ "/": path })),
        ],
      }],
    },
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
