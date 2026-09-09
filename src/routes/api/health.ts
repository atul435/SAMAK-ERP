import { createFileRoute } from "@tanstack/react-router";

// Unauthenticated by design — an uptime monitor (UptimeRobot, Better Stack,
// a cron curl on the VPS) needs to reach this without a session. It reveals
// nothing beyond "is the app up and can it reach its database."
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("companies").select("id").limit(1);
          if (error) throw error;
          return Response.json({
            status: "ok",
            database: "reachable",
            latency_ms: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          return Response.json(
            {
              status: "error",
              database: "unreachable",
              error: err instanceof Error ? err.message : "Unknown error",
              timestamp: new Date().toISOString(),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
