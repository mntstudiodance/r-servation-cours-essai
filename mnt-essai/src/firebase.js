import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

// Config de ton projet Firebase MNT Studio Dance (même projet que
// l'appli de gestion des présences).
const firebaseConfig = {
  apiKey: "AIzaSyDAXL6ngQb0lOzFwUUkyb0ssO2Pe85Qx4M",
  authDomain: "mnt-studio-dance-appel.firebaseapp.com",
  projectId: "mnt-studio-dance-appel",
  storageBucket: "mnt-studio-dance-appel.firebasestorage.app",
  messagingSenderId: "434673162498",
  appId: "1:434673162498:web:c30263b7169bbc63bc4a1b"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'europe-west1')
