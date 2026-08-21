import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc,
  deleteDoc,
  orderBy 
} from 'firebase/firestore';

const LOCAL_REVIEWS_KEY = 'ep_cached_reviews';

function getLocalReviews() {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalReviews(list) {
  try {
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function getCachedReviewsSync(eventId = null) {
  const list = getLocalReviews();
  if (eventId) return list.filter(r => r.eventId === eventId);
  return list;
}

/**
 * Submit or update a student event review & rating
 */
export async function submitReview({ eventId, eventTitle, rating, reviewText, user }) {
  if (!user) return { success: false, error: 'Please sign in to leave a review.' };

  const reviewId = `${eventId}_${user.uid}`;
  const reviewData = {
    id: reviewId,
    eventId,
    eventTitle,
    rating: Number(rating) || 5,
    reviewText: (reviewText || '').trim(),
    userId: user.uid,
    studentName: user.name,
    department: user.department,
    year: user.year,
    division: user.division || 'A',
    createdAt: new Date().toISOString()
  };

  // Immediate local cache update
  const current = getLocalReviews();
  const existingIdx = current.findIndex(r => r.id === reviewId);
  if (existingIdx >= 0) {
    current[existingIdx] = reviewData;
  } else {
    current.unshift(reviewData);
  }
  saveLocalReviews(current);

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'reviews', reviewId), reviewData, { merge: true });
    return { success: true, review: reviewData };
  } catch (err) {
    console.warn('Review submit notice:', err.message);
    return { success: true, review: reviewData };
  }
}

/**
 * Get all reviews for a specific event
 */
export async function getEventReviews(eventId) {
  try {
    const q = query(collection(db, 'reviews'), where('eventId', '==', eventId));
    const snap = await Promise.race([
      getDocs(q),
      new Promise(res => setTimeout(() => res(null), 3000))
    ]);

    if (snap) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // merge with cache
      const current = getLocalReviews().filter(r => r.eventId !== eventId);
      saveLocalReviews([...list, ...current]);
      return list;
    }
    return getLocalReviews().filter(r => r.eventId === eventId);
  } catch (err) {
    return getLocalReviews().filter(r => r.eventId === eventId);
  }
}

/**
 * Calculate average rating and review count for an event
 */
export function getEventRatingStats(eventId) {
  const reviews = getCachedReviewsSync(eventId);
  if (reviews.length === 0) return { avgRating: 5.0, totalReviews: 0 };
  
  const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
  const avg = (sum / reviews.length).toFixed(1);
  return { avgRating: Number(avg), totalReviews: reviews.length };
}

/**
 * Delete a review (Student author or Admin)
 */
export async function deleteReview(reviewId, eventId = null) {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
    const current = getLocalReviews().filter(r => r.id !== reviewId);
    saveLocalReviews(current);
    return { success: true };
  } catch (err) {
    const current = getLocalReviews().filter(r => r.id !== reviewId);
    saveLocalReviews(current);
    return { success: true };
  }
}
