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

  // Contexte systeme injecte en premier message utilisateur (system prompt via user turn pour Gemini)
  const systemContext = `Tu es l'assistant de SOS-PC, un service de depannage informatique professionnel base en France.
Tu viens de realiser un diagnostic du PC de l'utilisateur.

Rapport de diagnostic :
${JSON.stringify(report, null, 2)}

Donnees techniques du PC :
${JSON.stringify(systemData, null, 2)}

Reponds aux questions de l'utilisateur de facon claire et simple.
Tu peux proposer des solutions a faire soi-meme OU recommander de faire appel a SOS-PC si c'est plus adapte.
Reponds en francais, de facon concise et bienveillante. 2-3 phrases maximum sauf si l'utilisateur demande plus de details.`;

  // Convertir l'historique au format Gemini
  // Gemini : role "user" | "model" (pas "assistant")
  // Premier message = contexte systeme + premier message user
  const geminiContents = [];

  messages.forEach((msg, i) => {
    const role = msg.role === "user" ? "user" : "model";
    let text = msg.content;

    // Injecter le contexte systeme avant le premier message utilisateur
    if (i === 0 && msg.role === "user") {
      text = systemContext + "\n\n---\n\nQuestion de l'utilisateur : " + msg.content;
    }

    // Gemini n'accepte pas deux messages consecutifs du meme role
    // Si le dernier message ajouté a le même role, on fusionne
    if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
      geminiContents[geminiContents.length - 1].parts[0].text += "\n" + text;
    } else {
      geminiContents.push({ role, parts: [{ text }] });
    }
  });

  // Gemini exige que le dernier message soit "user"
  if (geminiContents.length === 0 || geminiContents[geminiContents.length - 1].role !== "user") {
    return new Response(JSON.stringify({ error: "Historique invalide" }), { status: 400, headers });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
