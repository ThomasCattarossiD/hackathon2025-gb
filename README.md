# 🏢 ROOMBARBER Workspace (Projet Hackathon 2025)

> **Hackathon/Projet Étudiant** : Application mobile intelligente de gestion des espaces de travail via interaction naturelle.

## 📋 Présentation

Dans le cadre du déménagement de GoodBarber dans son nouveau bâtiment en 2026, ce projet vise à fluidifier la gestion des salles de réunion. Fini les formulaires complexes : l'utilisateur discute simplement avec un **Agent Intelligent** (vocal ou texte) pour trouver et réserver un espace.

### ✨ Fonctionnalités Principales (MVP)
- **💬 Interaction Naturelle :** Chatbot intelligent capable de comprendre des requêtes complexes ("Trouve une salle pour 4 cet après-midi").
- **🎙️ Commande Vocale :** Support Speech-to-Text pour réserver en marchant.
- **📅 Gestion de Planning :** Vérification des disponibilités en temps réel et détection de conflits.
- **🧠 Intelligence Contextuelle :** L'agent demande des précisions s'il manque des infos (durée, nombre de personnes).
- **📱 Mobile First :** Interface pensée comme une Progressive Web App (PWA) pour un usage sur smartphone.

---

## 🛠 Stack Technique

Une architecture moderne, rapide et scalable :

- **Frontend :** [Next.js 14](https://nextjs.org/) (App Router) + [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling :** [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/ui](https://ui.shadcn.com/) (Composants accessibles)
- **Backend & Database :** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime)
- **Intelligence Artificielle :** [OpenAI API](https://openai.com/) (GPT-4o-mini) via [Vercel AI SDK](https://sdk.vercel.ai/)

---

## 🚀 Guide d'Installation (Pour les dev)

Suivez ces étapes pour lancer le projet en local en moins de 5 minutes.

### 1. Cloner le projet
```bash
git clone https://github.com/ThomasCattarossiD/hackathon2025-gb
cd hackathon2025-gb
```

### 2. Installer les dépendances
```bash
# Note : Ne jamais supprimer package-lock.json !
npm install
```

### 3. Configurer les variables d'environnement

⚠️ Important : Les clés API ne sont pas sur GitHub pour des raisons de sécurité.
    - Dupliquez le fichier **.env.example** situé à la racine.
    - Renommez la copie en **.env**
    - Remplissez les valeurs avec les clés fournies par le Lead Tech (ou via notre messagerie sécurisée).

Votre fichier .env.local doit ressembler à ça :
```ts
NEXT_PUBLIC_SUPABASE_URL=[https://xyz.supabase.co](https://xyz.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...
OPENAI_API_KEY=sk-proj-...
```

### 4. Lancer le serveur de développement

```bash
# Dans votre terminal
npm run dev
```
Ouvrez http://localhost:3000 dans votre navigateur.

Si tout se passe bien! Vous pouvez commencer directement à travailler sur le projet!

### 🗄️ Base de Données (Supabase)

Si vous devez configurer une nouvelle instance Supabase, le schéma SQL complet se trouve dans le fichier : 📄 schema.sql (à la racine du projet).

Copiez le contenu de ce fichier dans l'éditeur SQL de votre dashboard Supabase pour créer les tables rooms, bookings, etc.

### 🤝 Guide de Collaboration (Git Flow)

Pour éviter les conflits et garder un code propre, merci de respecter ces règles scrupuleusement :

    🚫 Jamais de commit direct sur main La branche main est la version "production" stable. On n'y touche pas directement.

    🌿 Une branche par fonctionnalité Créez toujours une nouvelle branche pour travailler :

    ```bash
    git checkout -b feature/nom-de-ma-tache
    # Exemple : git checkout -b feature/chat-interface
    # Exemple : git checkout -b fix/booking-bug
    ```

    🔄 Pull Request (PR) Une fois votre tâche terminée :

        git push origin feature/nom-de-ma-tache

        Allez sur GitHub et ouvrez une "Pull Request" vers main.

        Attendez ma validation avant de fusionner (Merge).

    📝 Messages de commit clairs Essayez d'être descriptif :

        ✅ feat: ajoute le bouton micro

        ✅ fix: corrige le bug de date

        ❌ update, test, fgjh