# SOS-PC Diagnostic Intelligent v2

Outil de diagnostic PC alimenté par Claude AI, intégré à [sos-pc.click](https://sos-pc.click).

## Architecture

```
public/diag.ps1                 → Script PowerShell hébergé (irm | iex)
src/pages/diagnostic.astro      → Page /diagnostic du site
netlify/functions/analyze.js    → API analyse Claude
netlify/functions/chat.js       → API chat Claude
netlify.toml                    → Config Netlify
```

## Flow utilisateur

1. L'utilisateur clique sur "Lancer le diagnostic" sur la page
2. Il copie la commande `irm https://sos-pc.click/diag.ps1 | iex`
3. Il ouvre PowerShell (Win+X → Terminal) et colle
4. Le script collecte les infos et ouvre `sos-pc.click/diagnostic?d=BASE64`
5. La page affiche les données collectées + champ "Quel est votre problème ?"
6. Claude analyse tout et affiche un rapport structuré
7. L'utilisateur peut chatter avec l'IA pour plus de détails

## Setup

### 1. Variables d'environnement Netlify

Dans le dashboard Netlify → Site Settings → Environment Variables :

```
ANTHROPIC_API_KEY = sk-ant-...
```

### 2. Intégration dans le site Astro existant

Copier `src/pages/diagnostic.astro` dans le projet sos-pc-website.

Ou déployer ce repo séparément sur Netlify et configurer un redirect :
```
# Dans netlify.toml du site principal
[[redirects]]
  from = "/diagnostic"
  to = "https://sos-pc-diagnostic.netlify.app/diagnostic"
  status = 200
  force = true
```

### 3. Test local

```bash
npm install -g netlify-cli
netlify dev
```

Puis ouvrir `http://localhost:8888/diagnostic`

## Données collectées par le script

- OS Windows (version, build, uptime)
- CPU (modèle, cœurs, charge actuelle)
- RAM (total, disponible)
- GPU (modèle, VRAM, version driver)
- Disques (espace libre/total par lettre)
- Top 8 processus par consommation RAM
- Apps au démarrage automatique
- Événements critiques des 24 dernières heures (count + échantillons)

Aucune donnée personnelle (fichiers, mots de passe, historique) n'est collectée.

## Coût API estimé

~$0.002 par diagnostic complet (Claude Haiku).
100 diagnostics/mois ≈ $0.20

## Licence

MIT — SOS-PC 2026
