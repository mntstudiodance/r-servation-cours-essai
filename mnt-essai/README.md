# MNT Studio Dance — Réservation cours d'essai

## ⚠️ Important — pourquoi cette version est différente

Ta base Firestore stocke tout dans **un seul document**
(`mnt-studio/mnt-studio-data-v2`), qui contient à la fois les cours **et**
des données sensibles : mot de passe admin en clair, mots de passe des
profs, et la liste des élèves (~2900 entrées).

➡️ **Vérifie en priorité les règles Firestore de ton projet actuel.** Si
elles autorisent la lecture publique de ce document (`allow read: if
true`), n'importe qui peut aujourd'hui voir ces mots de passe et ces
données élèves en ouvrant l'inspecteur du navigateur sur une de tes
appli. C'est indépendant de cette nouvelle appli — à corriger dans tous
les cas.

Pour cette appli de réservation, je ne lis donc **jamais** ce document
directement depuis le navigateur. À la place, une **Cloud Function**
(`functions/getTrialCourses`) va chercher les données côté serveur (avec
les droits admin) et ne renvoie que ce qui est nécessaire : nom du cours,
jour, site, horaire, prof — jamais les mots de passe, jamais les élèves.

## 1. Installer et lancer en local

```bash
npm install
npm run dev
```

## 2. Connecter ton projet Firebase

Dans `src/firebase.js`, remplace `firebaseConfig` par la config de ton
projet Firebase existant (Console Firebase > Paramètres du projet > Config
SDK).

## 3. Déployer la Cloud Function

Depuis la racine du projet :

```bash
npm install -g firebase-tools   # si pas déjà installé
firebase login
firebase init functions         # sélectionne ton projet existant, dossier "functions" déjà présent, ne pas écraser index.js
cd functions && npm install && cd ..
firebase deploy --only functions:getTrialCourses
```

Note la région utilisée dans `functions/index.js` (`europe-west1` par
défaut) — elle doit correspondre à celle utilisée dans
`src/firebase.js` (`getFunctions(app, 'europe-west1')`).

## 4. Verrouiller les règles Firestore

Le principe : la collection `mnt-studio` (qui contient le document
sensible) ne doit **jamais** être lisible directement par un client, y
compris pour tes autres applis si ce n'est pas déjà le cas. Seule la
Cloud Function y accède (elle utilise les droits admin, qui ignorent les
règles).

Les deux nouvelles collections créées par cette appli, elles, doivent
autoriser l'écriture publique (formulaire sans connexion) :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Données sensibles : jamais de lecture/écriture côté client
    match /mnt-studio/{doc} {
      allow read, write: if false;
    }

    // Réservations de cours d'essai : écriture publique, pas de lecture
    match /essai_reservations/{doc} {
      allow read: if false;
      allow create: if true;
    }

    // Emails déclenchés par l'extension Trigger Email
    match /mail/{doc} {
      allow read: if false;
      allow create: if true;
    }
  }
}
```

⚠️ Ne remplace pas l'intégralité de ton fichier de règles sans vérifier
ce qui existe déjà pour tes autres apps (staff, attendance, etc.) — fusionne
plutôt ces blocs avec les règles existantes.

## 5. Installer l'extension Firebase "Trigger Email"

1. Console Firebase → **Extensions** → **"Trigger Email"** (éditeur
   Firebase officiel) → Installer.
2. Renseigne un fournisseur SMTP (Gmail avec mot de passe d'application,
   ou Brevo/SendGrid en offre gratuite).
3. Collection à surveiller : `mail` (déjà utilisée dans le code).

## 6. Adresse email du studio

Dans `src/App.jsx`, remplace `contact@mntstudiodance.fr` par la vraie
adresse qui doit recevoir les récapitulatifs de réservation.

## 7. Déployer le site sur Netlify

Build command `npm run build`, publish directory `dist` (déjà configuré
dans `netlify.toml`). Le dossier `functions/` n'est pas déployé par
Netlify — il est déployé séparément via `firebase deploy` (étape 3).

## Marquer un cours comme "COMPLET"

Pas besoin de toucher au code. Dans la Console Firebase > Firestore
Database :

1. Va dans la collection `essai_config` (crée-la si elle n'existe pas
   encore : "Commencer une collection").
2. Crée (ou ouvre) un document avec l'ID exact `settings`.
3. Ajoute un champ `fullCourseIds` de type **tableau (array)**.
4. Ajoute dedans l'`id` du cours à marquer complet (visible dans le champ
   `id` de chaque cours, section `courses`, dans le document
   `mnt-studio-data-v2`).

Pour rouvrir un cours, retire simplement son ID de ce tableau. Le
changement est visible sur le site après quelques secondes, sans
redéploiement.

## Personnalisation

- Palette et police dans `tailwind.config.js` (thème théâtre/spotlight :
  noir profond, magenta, or, Bebas Neue).
- Nombre de dates proposées par cours : `CONFIG.weeksAhead` dans
  `src/App.jsx` (4 par défaut).
