import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/gate/open")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { bookingId?: string; type?: string };
          if (!body.bookingId || !body.type) {
            return Response.json({ success: false, error: "bookingId and type required" }, { status: 400 });
          }
          // In production this would signal the ESP32 servo.
          console.log(`[GATE OPEN] booking=${body.bookingId} type=${body.type}`);
          return Response.json({ success: true });
        } catch (e: any) {
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS" },
        }),
    },
  },
});
