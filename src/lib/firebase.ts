import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB_t9_0fUlS9AbIEuIyoJB-nhIeUTviu8Y",
  authDomain: "app-d7397.firebaseapp.com",
  databaseURL: "https://app-d7397-default-rtdb.firebaseio.com",
  projectId: "app-d7397",
  storageBucket: "app-d7397.firebasestorage.app",
  messagingSenderId: "538283025810",
  appId: "1:538283025810:web:7dc45efc541c332e2a8d4b",
  measurementId: "G-20JJF8G8CD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);