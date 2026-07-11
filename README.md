# Mandat OS

Application interne de pilotage immobilier pour Alexandre Lopez : prospection, radar marche, opportunites, clients, IA, synchronisations Stream Estate et suivi des mandats.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase
- Vercel

## Développement local

```bash
npm install
npm run dev -- --port=3002
```

URL locale recommandée :

```txt
http://localhost:3002/app/dashboard
```

## Vérifications

```bash
npm run lint
npm run build
```

## Déploiement

- Projet Vercel : `mandat-os-alexandre-lopez`
- Domaine cible : `https://app.alexandrelopez.fr`
- Cron : `/api/jobs/sync-zones`, tous les jours à 03:00

Configurer les variables depuis `.env.example` dans Vercel avant d’activer les synchronisations.
