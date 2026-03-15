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

  // Construction du rapport texte sans template literals imbriqués
  const d = data;
  const lines = [];

  lines.push("Tu es un expert en depannage PC Windows pour SOS-PC, service de reparation informatique en France.");
  lines.push("Analyse les donnees systeme et reponds UNIQUEMENT en JSON valide (sans markdown ni backticks) avec cette structure :");
  lines.push('{"summary":"...","score":85,"issues":[{"level":"critical|warning|ok","category":"RAM|CPU|Stockage|Temperature|Demarrage|Systeme|Securite","title":"...","description":"...","action":"..."}],"quick_wins":["..."],"needs_professional":true,"professional_reason":"..."}');
  lines.push("score = sante du PC de 0 a 100. Sois honnete mais rassurant.");
  lines.push("---");
  lines.push("Probleme decrit : " + (problem || "Non precise"));
  lines.push("");
  lines.push("OS : " + (d.os && d.os.name ? d.os.name : "inconnu") + " build " + (d.os && d.os.build ? d.os.build : "?"));
  lines.push("Arch : " + (d.os && d.os.arch ? d.os.arch : "?") + " | Uptime : " + (d.os && d.os.uptime ? d.os.uptime : "?") + "h");

  const ramTotal = d.os && d.os.ram_total_gb ? parseFloat(d.os.ram_total_gb) : 0;
  const ramFree  = d.os && d.os.ram_free_gb  ? parseFloat(d.os.ram_free_gb)  : 0;
  const ramPct   = ramTotal > 0 ? Math.round((1 - ramFree / ramTotal) * 100) : "?";
  lines.push("RAM : " + ramTotal + " Go total | " + ramFree + " Go libre | " + ramPct + "% utilisee");

  lines.push("CPU : " + (d.cpu && d.cpu.name ? d.cpu.name : "?") + " | " + (d.cpu && d.cpu.cores ? d.cpu.cores : "?") + " coeurs | charge " + (d.cpu && d.cpu.load ? d.cpu.load : "?") + "%");
  lines.push("GPU : " + (d.gpu && d.gpu.name ? d.gpu.name : "?") + " | " + (d.gpu && d.gpu.ram_mb ? d.gpu.ram_mb : "?") + " Mo VRAM");

  lines.push("DISQUES :");
  if (d.disks && d.disks.length > 0) {
    d.disks.forEach(function(disk) {
      lines.push("  " + disk.letter + " : " + disk.free_gb + " Go libre / " + disk.total_gb + " Go (" + disk.pct_used + "% utilise)");
    });
  } else {
    lines.push("  Aucun disque detecte");
  }

  lines.push("PROCESSUS (top RAM) :");
  if (d.procs && d.procs.length > 0) {
    d.procs.slice(0, 8).forEach(function(p) {
      lines.push("  " + p.name + " : " + p.ram_mb + " Mo");
    });
  }

  lines.push("DEMARRAGE : " + (d.startup && d.startup.length > 0 ? d.startup.join(", ") : "Aucun"));
  lines.push("EVENEMENTS 24h : " + (d.events && d.events.critical_24h ? d.events.critical_24h : 0) + " erreurs critiques");

  if (d.events && d.events.samples && d.events.samples.length > 0) {
    d.events.samples.forEach(function(e) {
      lines.push("  [ID " + e.id + "] " + e.msg);
    });
  }

  lines.push("---");
  lines.push("Fournis le JSON de diagnostic complet.");

  const prompt = lines.join("\n");

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini API error:", err);
      return new Response(JSON.stringify({ error: "Erreur API Gemini", detail: err }), { status: 502, headers });
    }

    const result = await response.json();
    const rawText = (result.candidates &&
                     result.candidates[0] &&
                     result.candidates[0].content &&
                     result.candidates[0].content.parts &&
                     result.candidates[0].content.parts[0] &&
                     result.candidates[0].content.parts[0].text) ? result.candidates[0].content.parts[0].text : "";

    let report;
    try {
      const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      report = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "raw:", rawText);
      return new Response(JSON.stringify({ error: "Reponse IA invalide", raw: rawText }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ report }), { status: 200, headers });

  } catch (err) {
    console.error("Fetch error:", err);
    return new Response(JSON.stringify({ error: "Erreur reseau", detail: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/analyze" };
