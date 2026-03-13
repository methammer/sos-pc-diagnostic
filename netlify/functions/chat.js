// ============================================================
//  SOS-PC - Netlify Function : chat.js
//  POST /api/chat
//  Body : { messages: [...], systemData: {...}, report: {...} }
// ============================================================

export default async (req) => {

  const headers = {
    "Access-Control-Allow-Origin": "https://sos-pc.click",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "Clé API manquante" }), { status: 500, headers });

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Corps invalide" }), { status: 400, headers });
  }

  const { messages, systemData, report } = body;

  const systemPrompt = `Tu es l'assistant de SOS-PC, un service de dépannage informatique professionnel.
Tu viens de réaliser un diagnostic du PC de l'utilisateur. Voici le rapport :
${JSON.stringify(report, null, 2)}

Données techniques du PC :
${JSON.stringify(systemData, null, 2)}

Réponds aux questions de l'utilisateur de façon claire et simple. 
Tu peux proposer des solutions à faire soi-même OU recommander de faire appel à SOS-PC si c'est plus adapté.
Réponds en français, de façon concise et bienveillante.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: systemPrompt,
        messages: messages || [],
      }),
    });

    if (!response.ok) return new Response(JSON.stringify({ error: "Erreur API" }), { status: 502, headers });

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    return new Response(JSON.stringify({ message: text }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Erreur réseau" }), { status: 500, headers });
  }
};

export const config = { path: "/api/chat" };
