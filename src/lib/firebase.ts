import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Song, Playlist } from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth & Firestore
export const auth = getAuth(app);

const databaseId = (firebaseConfig as any).firestoreDatabaseId;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Store YouTube Access Token in memory
let youtubeAccessToken: string | null = null;
let isFirestoreQuotaExhausted = false;

function handleFirestoreError(err: any, operation: string) {
  const errMsg = err?.message || String(err || '');
  const errCode = err?.code || '';
  if (
    errCode === 'resource-exhausted' ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded')
  ) {
    if (!isFirestoreQuotaExhausted) {
      isFirestoreQuotaExhausted = true;
      console.warn(
        `Firestore quota limit reached during ${operation}. Gracefully using local storage for full offline persistence.`
      );
    }
    return;
  }
  console.warn(`Firestore ${operation} warning:`, errMsg);
}

export function getYouTubeAccessToken(): string | null {
  return youtubeAccessToken || sessionStorage.getItem('yt_access_token');
}

// Sign in with Google Auth Popup
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string | null }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;

    if (accessToken) {
      youtubeAccessToken = accessToken;
      sessionStorage.setItem('yt_access_token', accessToken);
    }

    if (result.user && !isFirestoreQuotaExhausted) {
      // Create or update user profile document in Firestore
      try {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(
          userRef,
          {
            id: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err: any) {
        handleFirestoreError(err, 'user profile sync');
      }
    }
    return { user: result.user, accessToken };
  } catch (err: any) {
    console.error('Google Sign-In failed:', err);
    throw err;
  }
}

// Sign out function
export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error('Sign-Out failed:', err);
    throw err;
  }
}

// Auth State Listener Hook Helper
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/* ----------------- FIRESTORE SYNC HELPERS ----------------- */

// Sync User Favorites with Firestore
export async function syncFavoriteToFirestore(userId: string, song: Song, isFavorite: boolean): Promise<void> {
  if (!userId || isFirestoreQuotaExhausted) return;
  const favoriteDocId = `${userId}_${song.id}`;
  const favRef = doc(db, 'user_favorites', favoriteDocId);

  try {
    if (isFavorite) {
      await setDoc(favRef, {
        id: favoriteDocId,
        userId,
        songId: song.id,
        song,
        addedAt: new Date().toISOString(),
      });
    } else {
      await deleteDoc(favRef);
    }
  } catch (err: any) {
    handleFirestoreError(err, 'favorite sync');
  }
}

export async function fetchUserFavoritesFromFirestore(userId: string): Promise<Song[]> {
  if (!userId || isFirestoreQuotaExhausted) return [];
  try {
    const favsRef = collection(db, 'user_favorites');
    const q = query(favsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const songs: Song[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.song) {
        songs.push(data.song as Song);
      }
    });
    return songs;
  } catch (err: any) {
    handleFirestoreError(err, 'favorites fetch');
    return [];
  }
}

// Sync User Playlists with Firestore
export async function syncPlaylistToFirestore(userId: string, playlist: Playlist): Promise<void> {
  if (!userId || isFirestoreQuotaExhausted) return;
  const playlistRef = doc(db, 'user_playlists', playlist.id);
  try {
    await setDoc(playlistRef, {
      ...playlist,
      userId,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    handleFirestoreError(err, 'playlist sync');
  }
}

export async function deletePlaylistFromFirestore(playlistId: string): Promise<void> {
  if (!playlistId || isFirestoreQuotaExhausted) return;
  try {
    const playlistRef = doc(db, 'user_playlists', playlistId);
    await deleteDoc(playlistRef);
  } catch (err: any) {
    handleFirestoreError(err, 'playlist delete');
  }
}

export async function fetchUserPlaylistsFromFirestore(userId: string): Promise<Playlist[]> {
  if (!userId || isFirestoreQuotaExhausted) return [];
  try {
    const playlistsRef = collection(db, 'user_playlists');
    const q = query(playlistsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const playlists: Playlist[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        playlists.push(data as Playlist);
      }
    });
    return playlists;
  } catch (err: any) {
    handleFirestoreError(err, 'playlists fetch');
    return [];
  }
}

// Sync User Offline Cached Songs to Firestore
export async function syncCachedSongToFirestore(userId: string, song: Song, isCached: boolean): Promise<void> {
  if (!userId || isFirestoreQuotaExhausted) return;
  const cacheDocId = `${userId}_${song.id}`;
  const cacheRef = doc(db, 'user_cached_songs', cacheDocId);

  try {
    if (isCached) {
      await setDoc(cacheRef, {
        id: cacheDocId,
        userId,
        songId: song.id,
        song,
        cachedAt: Date.now(),
      });
    } else {
      await deleteDoc(cacheRef);
    }
  } catch (err: any) {
    handleFirestoreError(err, 'cached song sync');
  }
}

// Fetch User Offline Cached Songs from Firestore
export async function fetchUserCachedSongsFromFirestore(userId: string): Promise<Song[]> {
  if (!userId || isFirestoreQuotaExhausted) return [];
  try {
    const cacheRef = collection(db, 'user_cached_songs');
    const q = query(cacheRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const songs: Song[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.song) {
        songs.push(data.song as Song);
      }
    });
    return songs;
  } catch (err: any) {
    handleFirestoreError(err, 'cached songs fetch');
    return [];
  }
}

