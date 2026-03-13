import { getStore } from "@netlify/blobs";
export default async (req) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Methode non autorisee" }), { status: 405, headers });
  let body; try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers }); }
  const { session, data } = body;
  if (!session || !data) return new Response(JSON.stringify({ error: "session et data requis" }), { status: 400, headers });
  const s = session.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  if (!s) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 400, headers });
  try { const store = getStore("diagnostic-sessions"); await store.setJSON(`session-${s}`, { data, created_at: new Date().toISOString() }); return new Response(JSON.stringify({ ok: true }), { status: 200, headers }); }
  catch (err) { return new Response(JSON.stringify({ error: "Erreur stockage" }), { status: 500, headers }); }
};
export const config = { path: "/api/collect" };
