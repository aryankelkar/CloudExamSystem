// Firebase Authentication abstraction layer
// Swap the underlying provider here without touching any page/service code

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase';

export const firebaseCreateUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const firebaseSignIn = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const firebaseSignOut = () => signOut(auth);

export const firebaseOnAuthStateChanged = (callback) =>
  onAuthStateChanged(auth, callback);

export { auth };
