import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy 
} from 'firebase/firestore';

const LOCAL_IDEAS_KEY = 'ep_cached_ideas';

// Clear any stale cached fake ideas on first load
(function clearLegacySeedData() {
  try {
    const raw = localStorage.getItem(LOCAL_IDEAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If any idea has a sample_ userId, wipe the whole cache so fake data is gone
      const hasFake = parsed.some(i => (i.userId || '').startsWith('sample_'));
      if (hasFake) {
        localStorage.removeItem(LOCAL_IDEAS_KEY);
      }
    }
  } catch (e) {
    localStorage.removeItem(LOCAL_IDEAS_KEY);
  }
})();

function getLocalIdeas() {
  try {
    const raw = localStorage.getItem(LOCAL_IDEAS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLocalIdeas(list) {
  try {
    localStorage.setItem(LOCAL_IDEAS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function getCachedIdeasSync() {
  return getLocalIdeas();
}

/**
 * Submit a new Campus Event Idea or Improvement
 */
export async function submitIdea({ 
  title, 
  type, 
  category, 
  description, 
  suggestedVenue, 
  suggestedGuest, 
  user 
}) {
  if (!user) return { success: false, error: 'Please sign in to submit an event idea.' };

  const ideaId = 'idea_' + Date.now();
  const ideaData = {
    id: ideaId,
    title: title.trim(),
    type: type || 'new_event',
    category: category || '✨ General Idea',
    description: description.trim(),
    suggestedVenue: (suggestedVenue || '').trim() || 'Campus Main Ground / Auditorium',
    suggestedGuest: (suggestedGuest || '').trim() || 'Student Talent / Industry Guest',
    userId: user.uid,
    authorName: user.name,
    department: user.department,
    year: user.year,
    division: user.division || 'A',
    upvotes: 1,
    upvotedBy: [user.uid],
    status: 'trending',
    comments: [],
    createdAt: new Date().toISOString()
  };

  // Immediate local cache
  const current = getLocalIdeas();
  current.unshift(ideaData);
  saveLocalIdeas(current);

  // Firestore sync
  try {
    await setDoc(doc(db, 'ideas', ideaId), ideaData);
    return { success: true, idea: ideaData };
  } catch (err) {
    console.warn('Idea submit notice:', err.message);
    return { success: true, idea: ideaData };
  }
}

/**
 * Toggle Upvote on an Idea
 */
export async function toggleUpvoteIdea(ideaId, user) {
  if (!user) return { success: false, error: 'Please sign in to vote.' };

  const current = getLocalIdeas();
  const idea = current.find(i => i.id === ideaId);
  if (!idea) return { success: false, error: 'Idea not found.' };

  idea.upvotedBy = idea.upvotedBy || [];
  const alreadyUpvoted = idea.upvotedBy.includes(user.uid);

  if (alreadyUpvoted) {
    idea.upvotedBy = idea.upvotedBy.filter(uid => uid !== user.uid);
    idea.upvotes = Math.max(0, (idea.upvotes || 1) - 1);
  } else {
    idea.upvotedBy.push(user.uid);
    idea.upvotes = (idea.upvotes || 0) + 1;
  }

  saveLocalIdeas(current);

  try {
    await setDoc(doc(db, 'ideas', ideaId), {
      upvotes: idea.upvotes,
      upvotedBy: idea.upvotedBy
    }, { merge: true });
    return { success: true, upvotes: idea.upvotes, hasUpvoted: !alreadyUpvoted };
  } catch (err) {
    return { success: true, upvotes: idea.upvotes, hasUpvoted: !alreadyUpvoted };
  }
}

/**
 * Add Comment / Suggestion to an Idea
 */
export async function addCommentToIdea(ideaId, text, user) {
  if (!user) return { success: false, error: 'Please sign in to comment.' };
  if (!text.trim()) return { success: false, error: 'Comment cannot be empty.' };

  const current = getLocalIdeas();
  const idea = current.find(i => i.id === ideaId);
  if (!idea) return { success: false, error: 'Idea not found.' };

  const commentObj = {
    id: 'c_' + Date.now(),
    authorName: user.name,
    department: user.department,
    text: text.trim(),
    time: 'Just now'
  };

  idea.comments = idea.comments || [];
  idea.comments.push(commentObj);
  saveLocalIdeas(current);

  try {
    await setDoc(doc(db, 'ideas', ideaId), { comments: idea.comments }, { merge: true });
    return { success: true, comment: commentObj };
  } catch (err) {
    return { success: true, comment: commentObj };
  }
}

/**
 * Get all Ideas from Firestore & local
 */
export async function getCampusIdeas() {
  try {
    const q = query(collection(db, 'ideas'));
    const snap = await Promise.race([
      getDocs(q),
      new Promise(res => setTimeout(() => res(null), 3000))
    ]);

    if (snap && snap.docs) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveLocalIdeas(list);
      return list;
    }
    return getLocalIdeas();
  } catch (err) {
    return getLocalIdeas();
  }
}

/**
 * Delete a Wishlist Idea or Improvement (Admin or Author)
 */
export async function deleteIdea(ideaId) {
  try {
    const current = getLocalIdeas();
    const updated = current.filter(i => i.id !== ideaId);
    saveLocalIdeas(updated);

    await deleteDoc(doc(db, 'ideas', ideaId));
    return { success: true };
  } catch (err) {
    console.warn('Idea deletion notice:', err.message);
    return { success: true };
  }
}
