// ⚠️ Remplacez les valeurs ci-dessous par celles de VOTRE projet Firebase.
// Vous les trouverez dans : Firebase Console > Paramètres du projet > Vos applications > Config SDK.
// Voir le fichier GUIDE-DEPLOIEMENT.md pour la marche à suivre pas à pas.

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDAXL6ngQb0lOzFwUUkyb0ssO2Pe85Qx4M",
  authDomain: "mnt-studio-dance-appel.firebaseapp.com",
  projectId: "mnt-studio-dance-appel",
  storageBucket: "mnt-studio-dance-appel.firebasestorage.app",
  messagingSenderId: "434673162498",
  appId: "1:434673162498:web:c30263b7169bbc63bc4a1b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
