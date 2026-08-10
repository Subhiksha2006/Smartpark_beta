import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sensor/update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { sensor_id?: string; occupied?: boolean };
          if (!body.sensor_id || typeof body.occupied !== "boolean") {
            return Response.json({ success: false, error: "sensor_id and occupied required" }, { status: 400 });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("sensor_events").insert({
            sensor_id: body.sensor_id,
            occupied: body.occupied,
          });
          const newStatus = body.occupied ? "occupied" : "available";
          const { error } = await supabaseAdmin
            .from("parking_slots")
            .update({ status: newStatus })
            .eq("sensor_id", body.sensor_id);
          if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }
          return Response.json({ success: true, status: newStatus });
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
