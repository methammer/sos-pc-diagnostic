// ============================================================
//  SOS-PC - Netlify Function : analyze.js
//  POST /api/analyze
//  Body : { data: { ...systemInfo }, problem: "description" }
//  Retourne : { report }
// ============================================================

export default async (req, context) => {

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
    return new Response(JSON.stringify({ error: "Corps de requete invalide" }), { status: 400, headers });
  }

  const { data, problem } = body;
  if (!data) return new Response(JSON.stringify({ error: "Donnees systeme manquantes" }), { status: 400, headers });

  const d = data;

  const prompt = `Tu es un expert en depannage PC Windows travaillant pour SOS-PC, un service de reparation informatique professionnel base en France.

Ton role : analyser les donnees techniques d'un PC et fournir un diagnostic clair, structure et comprehensible pour un utilisateur non-technique.

Reponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, avec cette structure exacte :
{
  "summary": "Resume en 1-2 phrases du diagnostic general",
  "score": 85,
  "issues": [
    {
      "level": "critical|warning|ok",
      "category": "RAM|CPU|Stockage|Temperature|Demarrage|Systeme|Securite",
      "title": "Titre court du probleme",
      "description": "Explication claire pour un non-technicien",
      "action": "Ce que SOS-PC peut faire pour resoudre ca"
    }
  ],
  "quick_wins": ["Conseil rapide 1", "Conseil rapide 2"],
  "needs_professional": true,
  "professional_reason": "Pourquoi faire appel a SOS-PC"
}

score = note globale de sante du PC de 0 a 100. Sois honnete mais rassurant.

---

Probleme decrit par l'utilisateur : "${problem || "Non precise"}"

SYSTEME D'EXPLOITATION
- ${d.os?.name || "—"} (Build ${d.os?.build || "—"})
- Architecture : ${d.os?.arch || "—"}
- Uptime : ${d.os?.uptime || "—"}h

MEMOIRE RAM
- Total : ${d.os?.ram_total_gb || "—"} Go
- Disponible : ${d.os?.ram_free_gb || "—"} Go
- Utilisee : ${d.os?.ram_total_gb && d.os?.ram_free_gb ? Math.round((1 - d.os.ram_free_gb / d.os.ram_total_gb) * 100) : "?"}%

PROCESSEUR
- ${d.cpu?.name || "—"}
- ${d.cpu?.cores || "—"} coeurs / ${d.cpu?.threads || "—"} threads
- Charge : ${d.cpu?.load || "—"}%

CARTE GRAPHIQUE
- ${d.gpu?.name || "—"}
- VRAM : ${d.gpu?.ram_mb || "—"} Mo

STOCKAGE
${(d.disks || []).map(disk => `- ${disk.letter} : ${disk.free_gb} Go libres / ${disk.total_gb} Go (${disk.pct_used}% utilise)`).join("\n") || "— Aucun disque detecte"}

TOP PROCESSUS (RAM)
${(d.procs || []).slice(0, 8).map(p => `- ${p.name} : ${p.ram_mb} Mo`).join("\n") || "—"}

DEMARRAGE AUTOMATIQUE
${(d.startup || []).join(", ") || "Aucun detecte"}

JOURNAL D'EVENEMENTS (24h)
- Erreurs critiques : ${d.events?.critical_24h || 0}
${(d.events?.samples || []).map(e => `- [ID ${e.id}] ${e.msg}`).join("\n")}

Fournis le JSON de diagnostic complet.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini API error:", err);
      return new Response(JSON.stringify({ error: "Erreur API Gemini", detail: err }), { status: 502, headers });
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let report;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      report = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Reponse IA invalide", raw: rawText }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ report }), { status: 200, headers });

  } catch (err) {
    console.error("Fetch error:", err);
    return new Response(JSON.stringify({ error: "Erreur reseau", detail: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/analyze" };
