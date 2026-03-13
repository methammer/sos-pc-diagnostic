import { getStore } from "@netlify/blobs";
export default async (req) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const url = new URL(req.url);
  const s = (url.searchParams.get("s") || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  if (!s) return new Response(JSON.stringify({ ready: false }), { status: 400, headers });
  try { const store = getStore("diagnostic-sessions"); const entry = await store.get(`session-${s}`, { type: "json" }); if (!entry) return new Response(JSON.stringify({ ready: false }), { status: 200, headers }); await store.delete(`session-${s}`); return new Response(JSON.stringify({ ready: true, data: entry.data }), { status: 200, headers }); }
  catch (err) { return new Response(JSON.stringify({ ready: false }), { status: 200, headers }); }
};
export const config = { path: "/api/poll" };
