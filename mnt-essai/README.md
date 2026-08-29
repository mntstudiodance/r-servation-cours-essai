# MNT Studio Dance — Réservation cours d'essai

Appli React + Firebase + Tailwind pour réserver un cours d'essai. Même stack
que tes autres apps (gala, gestion studio) → déploiement Netlify.

## 1. Installer et lancer en local

```bash
npm install
npm run dev
```

## 2. Connecter ton projet Firebase

Ouvre `src/firebase.js` et remplace `firebaseConfig` par la config de ton
projet Firebase existant (Console Firebase > Paramètres du projet > Config
SDK). C'est le même projet que tes autres apps MNT Studio Dance, pour
accéder à la même collection de cours.

## 3. Vérifier la structure de tes cours (`courses`)

L'appli lit la collection Firestore `courses` et attend, pour chaque
document, des champs proches de :

| Champ attendu | Exemple                                    |
| -------------- | ------------------------------------------ |
| `nom`          | "Afrobeat Junior"                          |
| `jour`         | "Jeudi" (ou un nombre 0-6, 0 = dimanche)   |
| `site`         | "Savigny-le-Temple"                        |
| `professeur`   | "Adèle & Lowyzo"                           |
| `horaire`      | "18:00"                                    |
| `niveau`       | "Débutant" (optionnel)                     |

**Si tes vrais noms de champs sont différents**, il n'y a rien à réécrire :
ouvre `src/App.jsx`, en haut du fichier, section `CONFIG.fields`, et
remplace juste les valeurs à droite par tes vrais noms de champs Firestore.

Le champ `jour` doit correspondre au jour réel du cours : l'appli calcule
automatiquement les 4 prochaines dates de ce jour de la semaine, donc si un
cours a lieu le jeudi, seuls des jeudis seront proposés.

## 4. Installer l'extension Firebase "Trigger Email"

C'est la solution la plus simple pour envoyer les 2 mails (récap studio +
confirmation client) sans backend à coder :

1. Dans la Console Firebase → **Extensions** → cherche **"Trigger Email"**
   (par Firebase, éditeur officiel) → **Installer**.
2. Renseigne un fournisseur SMTP pendant l'installation. Options simples :
   - Un compte Gmail dédié avec un "mot de passe d'application" (gratuit,
     limite ~500 mails/jour, largement suffisant pour des réservations).
   - Ou un service comme SendGrid / Brevo (Sendinblue) en offre gratuite.
3. Choisis le nom de la collection Firestore à surveiller : indique
   **`mail`** (déjà utilisé dans le code, voir `CONFIG.mailCollection`).
4. Une fois installée, l'extension envoie automatiquement un email à chaque
   document ajouté dans `mail` — exactement ce que fait l'appli à la
   confirmation d'une réservation (un doc pour le studio, un doc pour le
   client).

## 5. Adresse email du studio

Dans `src/App.jsx`, remplace :

```js
adminEmail: 'contact@mntstudiodance.fr',
```

par la vraie adresse qui doit recevoir les récapitulatifs de réservation.

## 6. Règles de sécurité Firestore

Comme le formulaire est public (pas de connexion utilisateur), il faut
autoriser l'écriture publique uniquement sur les collections `essai_reservations`
et `mail`, et la lecture publique sur `courses`. Exemple de règles à adapter
dans `firestore.rules` :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /courses/{doc} {
      allow read: if true;
      allow write: if false;
    }
    match /essai_reservations/{doc} {
      allow read: if false;
      allow create: if true;
    }
    match /mail/{doc} {
      allow read: if false;
      allow create: if true;
    }
  }
}
```

Adapte selon les règles déjà en place sur ton projet — ne remplace pas
l'intégralité du fichier sans vérifier ce qui existe déjà pour tes autres
apps.

## 7. Déployer sur Netlify

Comme pour tes autres projets : connecte le repo à Netlify, build command
`npm run build`, publish directory `dist` (déjà configuré dans
`netlify.toml`). Ajoute ensuite le bouton sur ton site principal pointant
vers l'URL Netlify de cette appli.

## Personnalisation

- Palette et police définies dans `tailwind.config.js` (thème
  théâtre/spotlight, cohérent avec l'appli de gestion : noir profond,
  magenta, or, Bebas Neue).
- Nombre de dates proposées par cours : `CONFIG.weeksAhead` dans
  `src/App.jsx` (4 par défaut).
