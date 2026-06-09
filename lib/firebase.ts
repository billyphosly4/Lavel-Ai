import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAIBH-JAmwdWd_fkBJ-vD5aHhbnNT3HUUA",
  authDomain: "chatbot-ed0d8.firebaseapp.com",
  projectId: "chatbot-ed0d8",
  storageBucket: "chatbot-ed0d8.firebasestorage.app",
  messagingSenderId: "957208630603",
  appId: "1:957208630603:web:d460953a0135f0812704ce",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
