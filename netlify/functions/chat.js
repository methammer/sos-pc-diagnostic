// ============================================================
//  SOS-PC - Netlify Function : chat.js
//  POST /api/chat
//  Body : { messages: [...], systemData: {...}, report: {...} }
// ============================================================

export default async (req) => {

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Methode non autorisee" }), { status: 405, headers });

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "Cle API manquante" }), { status: 500, headers });

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Corps invalide" }), { status: 400, headers });
  }

  const { messages, systemData, report } = body;
  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages manquants" }), { status: 400, headers });
  }

  // Contexte systeme â€” sera prefixe au premier tour utilisateur
  const systemContext = `Tu es l'assistant de SOS-PC, un service de depannage informatique professionnel base en France.
Tu viens de realiser un diagnostic du PC de l'utilisateur.

Rapport de diagnostic :
${JSON.stringify(report, null, 2)}

Donnees techniques du PC :
${JSON.stringify(systemData, null, 2)}

Reponds aux questions de l'utilisateur de facon claire et simple.
Tu peux proposer des solutions a faire soi-meme OU recommander SOS-PC si c'est plus adapte.
Reponds en francais, de facon concise et bienveillante. 2-3 phrases max sauf si l'utilisateur demande plus de details.`;

  // Convertir au format Gemini (role: "user" | "model")
  // Regles :
  // - Le premier message DOIT etre "user"
  // - Pas deux messages consecutifs du meme role
  // - Les messages "assistant" deviennent "model"
  const geminiContents = [];
  let systemInjected = false;

  for (const msg of messages) {
    const role = msg.role === "user" ? "user" : "model";
    let text = msg.content;

    // Injecter le contexte systeme dans le premier message user
    if (role === "user" && !systemInjected) {
      text = systemContext + "\n\n---\n\n" + text;
      systemInjected = true;
    }

    // Si le premier message est "model" (assistant), l'encapsuler dans un echange user/model fictif
    if (!systemInjected && role === "model") {
      geminiContents.push({
        role: "user",
        parts: [{ text: systemContext + "\n\n---\n\nResume le diagnostic effectue." }]
      });
      systemInjected = true;
    }

    // Fusionner si meme role consecutif
    if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
      geminiContents[geminiContents.length - 1].parts[0].text += "\n" + text;
    } else {
      geminiContents.push({ role, parts: [{ text }] });
    }
  }

  // Securite : le dernier message doit etre "user"
  if (geminiContents.length === 0 || geminiContents[geminiContents.length - 1].role !== "user") {
    // Ajouter un message user de relance si l'historique se termine par "model"
    geminiContents.push({ role: "user", parts: [{ text: "Continue." }] });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini API error:", err);
      return new Response(JSON.stringify({ error: "Erreur API Gemini", detail: err }), { status: 502, headers });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ message: text }), { status: 200, headers });

  } catch (err) {
    console.error("Fetch error:", err);
    return new Response(JSON.stringify({ error: "Erreur reseau", detail: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/chat" };


