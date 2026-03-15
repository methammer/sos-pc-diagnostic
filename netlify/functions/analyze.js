// ============================================================
//  SOS-PC - Netlify Function : analyze.js
//  POST /api/analyze
// ============================================================

const ALLOWED_ORIGINS = [
  "https://sos-pc.click",
  "https://design-alternative--sos-pc-website-test-2.netlify.app",
  "http://localhost:4321",
  "http://localhost:3000",
];

function getAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export default async (req, context) => {

  const origin = req.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "MÃ©thode non autorisÃ©e" }), { status: 405, headers });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ClÃ© API manquante" }), { status: 500, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corps de requÃªte invalide" }), { status: 400, headers });
  }

  const { data, problem } = body;
  if (!data) {
    return new Response(JSON.stringify({ error: "DonnÃ©es systÃ¨me manquantes" }), { status: 400, headers });
  }

  const systemPrompt = `Tu es un expert en dÃ©pannage PC Windows travaillant pour SOS-PC, 
un service de rÃ©paration informatique professionnel basÃ© en France.

Ton rÃ´le : analyser les donnÃ©es techniques d'un PC et fournir un diagnostic clair, 
structurÃ© et comprÃ©hensible pour un utilisateur non-technique.

RÃ©ponds TOUJOURS en JSON valide avec cette structure exacte :
{
  "summary": "RÃ©sumÃ© en 1-2 phrases du diagnostic gÃ©nÃ©ral",
  "score": 85,
  "issues": [
    {
      "level": "critical|warning|ok",
      "category": "RAM|CPU|Stockage|TempÃ©rature|DÃ©marrage|SystÃ¨me|SÃ©curitÃ©",
      "title": "Titre court du problÃ¨me",
      "description": "Explication claire pour un non-technicien",
      "action": "Ce que SOS-PC peut faire pour rÃ©soudre Ã§a"
    }
  ],
  "quick_wins": ["Conseil rapide 1", "Conseil rapide 2"],
  "needs_professional": true,
  "professional_reason": "Pourquoi faire appel Ã  SOS-PC si needs_professional=true"
}

score = note globale de santÃ© du PC de 0 Ã  100.
Sois honnÃªte mais rassurant. Propose toujours une solution concrÃ¨te.`;

  const d = data;
  const userMessage = `
ProblÃ¨me dÃ©crit par l'utilisateur : "${problem || "Non prÃ©cisÃ©"}"

=== DONNÃ‰ES SYSTÃˆME COLLECTÃ‰ES ===

SYSTÃˆME D'EXPLOITATION
- ${d.os?.name} (Build ${d.os?.build})
- Architecture : ${d.os?.arch}
- Uptime depuis dernier redÃ©marrage : ${d.os?.uptime}h

MÃ‰MOIRE RAM
- Total : ${d.os?.ram_total_gb} Go
- Disponible : ${d.os?.ram_free_gb} Go
- UtilisÃ©e : ${d.os?.ram_total_gb && d.os?.ram_free_gb ? Math.round((1 - d.os.ram_free_gb / d.os.ram_total_gb) * 100) : '?'}%

PROCESSEUR
- ${d.cpu?.name}
- ${d.cpu?.cores} cÅ“urs / ${d.cpu?.threads} threads
- Charge actuelle : ${d.cpu?.load}%
- FrÃ©quence max : ${d.cpu?.max_mhz} MHz

CARTE GRAPHIQUE
- ${d.gpu?.name}
- VRAM : ${d.gpu?.ram_mb} Mo
- Driver : ${d.gpu?.driver}

STOCKAGE
${(d.disks || []).map(disk => \`- \${disk.letter} : \${disk.free_gb} Go libres / \${disk.total_gb} Go total (\${disk.pct_used}% utilisÃ©)\`).join('\n')}

TOP PROCESSUS (RAM)
${(d.procs || []).map(p => \`- \${p.name} : \${p.ram_mb} Mo RAM\`).join('\n')}

DÃ‰MARRAGE AUTOMATIQUE
${(d.startup || []).join(', ') || 'Aucun dÃ©tectÃ©'}

JOURNAL D'Ã‰VÃ‰NEMENTS (24 derniÃ¨res heures)
- Ã‰vÃ©nements critiques/erreurs : ${d.events?.critical_24h || 0}
${(d.events?.samples || []).map(e => \`- [ID \${e.id}] \${e.msg}\`).join('\n')}

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

    let report;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      report = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "RÃ©ponse IA invalide", raw: rawText }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ report }), { status: 200, headers });

  } catch (err) {
    console.error("Fetch error:", err);
    return new Response(JSON.stringify({ error: "Erreur rÃ©seau" }), { status: 500, headers });
  }
};

export const config = { path: "/api/analyze" };
