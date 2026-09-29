/**
 * EventPulse — Campus Moments Wall (Shared Photo Gallery) Service
 * Handles photo uploads, like reactions, moderation, and Firestore synchronization.
 */

import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

const CACHE_KEY = 'ep_campus_moments_v2_live';

// Auto-purge legacy demo caches
try {
  localStorage.removeItem('ep_campus_moments_v1');
  localStorage.removeItem('ep_campus_moments');
} catch (e) {}

// Pure live user uploads only (No dummy/seed data)
export const SEED_MOMENTS = [];

export function getCachedMomentsSync() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveMomentsToCache(moments) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(moments || []));
  } catch (e) {}
}

/**
 * Fetch all campus moments from Firestore with local fallback
 */
export async function getMoments() {
  try {
    const momentsRef = collection(db, 'moments');
    const q = query(momentsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot) {
      const items = [];
      snapshot.forEach((d) => {
        // Filter out any legacy seed IDs
        if (!d.id.startsWith('moment_seed_')) {
          items.push({ id: d.id, ...d.data() });
        }
      });
      saveMomentsToCache(items);
      return items;
    }
  } catch (err) {
    console.warn('Could not fetch moments from Firestore, using cache:', err.message);
  }

  return getCachedMomentsSync();
}

/**
 * Upload a new moment
 */
export async function uploadMoment({ eventId = 'general', eventTitle = 'Campus Life', photoDataUrl, caption, user }) {
  if (!photoDataUrl || !user) {
    throw new Error('Photo and authenticated user are required.');
  }

  const momentId = `moment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newMoment = {
    id: momentId,
    eventId: eventId || 'general',
    eventTitle: eventTitle || 'Campus Life',
    photoUrl: photoDataUrl,
    caption: caption || '',
    uploaderUid: user.uid,
    uploaderName: user.name || user.displayName || 'Campus Student',
    uploaderDept: user.department || 'General',
    uploaderRole: user.role || 'student',
    likesCount: 0,
    likedBy: [],
    createdAt: new Date().toISOString()
  };

  // Update Cache Immediately
  const current = getCachedMomentsSync();
  const updated = [newMoment, ...current];
  saveMomentsToCache(updated);

  // Sync to Firestore
  try {
    const docRef = doc(db, 'moments', momentId);
    await setDoc(docRef, newMoment);
  } catch (err) {
    console.warn('Firestore moment sync warning:', err.message);
  }

  return newMoment;
}

/**
 * Toggle like reaction on a moment
 */
export async function toggleLikeMoment(momentId, userId) {
  if (!userId) return null;

  const current = getCachedMomentsSync();
  const target = current.find((m) => m.id === momentId);
  if (!target) return null;

  const likedBy = Array.isArray(target.likedBy) ? [...target.likedBy] : [];
  const hasLiked = likedBy.includes(userId);

  if (hasLiked) {
    target.likedBy = likedBy.filter((uid) => uid !== userId);
    target.likesCount = Math.max(0, (target.likesCount || 1) - 1);
  } else {
    target.likedBy = [...likedBy, userId];
    target.likesCount = (target.likesCount || 0) + 1;
  }

  saveMomentsToCache(current);

  // Firestore update
  try {
    const docRef = doc(db, 'moments', momentId);
    await updateDoc(docRef, {
      likesCount: target.likesCount,
      likedBy: target.likedBy
    });
  } catch (err) {
    console.warn('Firestore like update warning:', err.message);
  }

  return target;
}

/**
 * Delete a moment (uploader, admin, or organizer only)
 */
export async function deleteMoment(momentId, user) {
  if (!user) return false;

  const current = getCachedMomentsSync();
  const target = current.find((m) => m.id === momentId);
  if (!target) return false;

  const canDelete = user.role === 'admin' || user.role === 'organizer' || target.uploaderUid === user.uid;
  if (!canDelete) {
    throw new Error('Unauthorized to delete this moment.');
  }

  const updated = current.filter((m) => m.id !== momentId);
  saveMomentsToCache(updated);

  try {
    const docRef = doc(db, 'moments', momentId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore moment delete warning:', err.message);
  }

  return true;
}
