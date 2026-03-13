// ============================================================
//  SOS-PC - Netlify Function : analyze.js
//  POST /api/analyze
//  Body : { data: { ...systemInfo }, problem: "description" }
//  Retourne : { report, sessionId }
// ============================================================

export default async (req, context) => {

  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "https://sos-pc.click",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Clé API manquante" }), { status: 500, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corps de requête invalide" }), { status: 400, headers });
  }

  const { data, problem } = body;
  if (!data) {
    return new Response(JSON.stringify({ error: "Données système manquantes" }), { status: 400, headers });
  }

  // Construction du prompt système
  const systemPrompt = `Tu es un expert en dépannage PC Windows travaillant pour SOS-PC, 
un service de réparation informatique professionnel basé en France.

Ton rôle : analyser les données techniques d'un PC et fournir un diagnostic clair, 
structuré et compréhensible pour un utilisateur non-technique.

Réponds TOUJOURS en JSON valide avec cette structure exacte :
{
  "summary": "Résumé en 1-2 phrases du diagnostic général",
  "score": 85,
  "issues": [
    {
      "level": "critical|warning|ok",
      "category": "RAM|CPU|Stockage|Température|Démarrage|Système|Sécurité",
      "title": "Titre court du problème",
      "description": "Explication claire pour un non-technicien",
      "action": "Ce que SOS-PC peut faire pour résoudre ça"
    }
  ],
  "quick_wins": ["Conseil rapide 1", "Conseil rapide 2"],
  "needs_professional": true|false,
  "professional_reason": "Pourquoi faire appel à SOS-PC si needs_professional=true"
}

score = note globale de santé du PC de 0 à 100.
Sois honnête mais rassurant. Propose toujours une solution concrète.`;

  // Construction du message utilisateur
  const d = data;
  const userMessage = `
Problème décrit par l'utilisateur : "${problem || "Non précisé"}"

=== DONNÉES SYSTÈME COLLECTÉES ===

SYSTÈME D'EXPLOITATION
- ${d.os?.name} (Build ${d.os?.build})
- Architecture : ${d.os?.arch}
- Uptime depuis dernier redémarrage : ${d.os?.uptime}h

MÉMOIRE RAM
- Total : ${d.os?.ram_total_gb} Go
- Disponible : ${d.os?.ram_free_gb} Go
- Utilisée : ${d.os?.ram_total_gb && d.os?.ram_free_gb ? Math.round((1 - d.os.ram_free_gb / d.os.ram_total_gb) * 100) : '?'}%

PROCESSEUR
- ${d.cpu?.name}
- ${d.cpu?.cores} cœurs / ${d.cpu?.threads} threads
- Charge actuelle : ${d.cpu?.load}%
- Fréquence max : ${d.cpu?.max_mhz} MHz

CARTE GRAPHIQUE
- ${d.gpu?.name}
- VRAM : ${d.gpu?.ram_mb} Mo
- Driver : ${d.gpu?.driver}

STOCKAGE
${(d.disks || []).map(disk => `- ${disk.letter} : ${disk.free_gb} Go libres / ${disk.total_gb} Go total (${disk.pct_used}% utilisé)`).join('\n')}

TOP PROCESSUS (RAM)
${(d.procs || []).map(p => `- ${p.name} : ${p.ram_mb} Mo RAM`).join('\n')}

DÉMARRAGE AUTOMATIQUE
${(d.startup || []).join(', ') || 'Aucun détecté'}

JOURNAL D'ÉVÉNEMENTS (24 dernières heures)
- Événements critiques/erreurs : ${d.events?.critical_24h || 0}
${(d.events?.samples || []).map(e => `- [ID ${e.id}] ${e.msg}`).join('\n')}

Analyse ce PC et fournis un diagnostic JSON complet.`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Claude API error:", err);
      return new Response(JSON.stringify({ error: "Erreur API Claude" }), { status: 502, headers });
    }

    const result = await response.json();
    const rawText = result.content?.[0]?.text || "";

    // Parse JSON proprement
    let report;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      report = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Réponse IA invalide", raw: rawText }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ report }), { status: 200, headers });

  } catch (err) {
    console.error("Fetch error:", err);
    return new Response(JSON.stringify({ error: "Erreur réseau" }), { status: 500, headers });
  }
};

export const config = { path: "/api/analyze" };
