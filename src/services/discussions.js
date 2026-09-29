/**
 * EventPulse — Event Discussion & Live Q&A Service
 * Handles asking questions, official organizer answers, upvotes, and Firestore synchronization.
 */

import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';

const CACHE_KEY_PREFIX = 'ep_event_discussions_';

// Seed sample questions for popular events so Q&A feels alive immediately
const SEED_QUESTIONS = {
  default: [
    {
      id: 'qa_seed_1',
      eventId: 'default',
      question: 'Is it mandatory to bring our own laptops, or will lab PCs be provided?',
      authorUid: 'user_kishor',
      authorName: 'Kishor Kharad',
      authorDept: 'IMtech',
      authorRole: 'student',
      upvotes: ['lead_dev_pratik', 'user_atharv'],
      isResolved: true,
      answers: [
        {
          id: 'ans_seed_1',
          text: 'High-performance lab PCs with required software will be available in Lab 506. However, bringing your own laptop is recommended for custom environments.',
          authorUid: 'lead_dev_pratik',
          authorName: 'Pratik Thorat',
          authorRole: 'admin',
          isOfficial: true,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'qa_seed_2',
      eventId: 'default',
      question: 'Will participants receive food coupons and certificates on the same day?',
      authorUid: 'user_atharv',
      authorName: 'Atharv Gholap',
      authorDept: 'IMtech',
      authorRole: 'student',
      upvotes: ['user_vedant'],
      isResolved: true,
      answers: [
        {
          id: 'ans_seed_2',
          text: 'Yes! Lunch tokens will be provided at morning reporting desk. Official cryptographic certificates will be released digitally on your EventPulse pass profile.',
          authorUid: 'lead_dev_pratik',
          authorName: 'Pratik Thorat',
          authorRole: 'admin',
          isOfficial: true,
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
    }
  ]
};

export function getCachedDiscussionsSync(eventId) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${eventId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return SEED_QUESTIONS[eventId] || SEED_QUESTIONS.default;
}

export function saveDiscussionsToCache(eventId, list) {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${eventId}`, JSON.stringify(list));
  } catch (e) {}
}

/**
 * Fetch all Q&A questions for a specific event
 */
export async function getEventDiscussions(eventId) {
  try {
    const qRef = collection(db, 'event_discussions');
    const q = query(qRef, where('eventId', '==', eventId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const items = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() });
      });
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      saveDiscussionsToCache(eventId, items);
      return items;
    }
  } catch (err) {
    console.warn('Could not fetch discussions from Firestore, using cache:', err.message);
  }

  const cached = getCachedDiscussionsSync(eventId);
  return cached && cached.length > 0 ? cached : SEED_QUESTIONS.default;
}

/**
 * Post a new question in event Q&A
 */
export async function askEventQuestion({ eventId, eventTitle, questionText, user }) {
  if (!eventId || !questionText || !user) {
    throw new Error('Missing required fields to post question.');
  }

  const questionId = `qa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newQuestion = {
    id: questionId,
    eventId,
    eventTitle: eventTitle || 'Campus Event',
    question: questionText.trim(),
    authorUid: user.uid,
    authorName: user.name || user.displayName || 'Student',
    authorDept: user.department || 'General',
    authorRole: user.role || 'student',
    upvotes: [],
    isResolved: false,
    answers: [],
    createdAt: new Date().toISOString()
  };

  const current = getCachedDiscussionsSync(eventId);
  const updated = [newQuestion, ...current];
  saveDiscussionsToCache(eventId, updated);

  try {
    const docRef = doc(db, 'event_discussions', questionId);
    await setDoc(docRef, newQuestion);
  } catch (err) {
    console.warn('Firestore question save warning:', err.message);
  }

  return newQuestion;
}

/**
 * Reply to a question
 */
export async function answerEventQuestion({ eventId, questionId, answerText, user, isOfficial = false }) {
  if (!questionId || !answerText || !user) {
    throw new Error('Answer text and authenticated user are required.');
  }

  const current = getCachedDiscussionsSync(eventId);
  const question = current.find((q) => q.id === questionId);
  if (!question) throw new Error('Question not found.');

  const isUserOrgOrAdmin = user.role === 'admin' || user.role === 'organizer' || isOfficial;

  const newAnswer = {
    id: `ans_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text: answerText.trim(),
    authorUid: user.uid,
    authorName: user.name || user.displayName || 'Student',
    authorDept: user.department || 'Campus',
    authorRole: user.role || 'student',
    isOfficial: isUserOrgOrAdmin,
    createdAt: new Date().toISOString()
  };

  question.answers = Array.isArray(question.answers) ? [...question.answers, newAnswer] : [newAnswer];
  if (isUserOrgOrAdmin) {
    question.isResolved = true;
  }

  saveDiscussionsToCache(eventId, current);

  try {
    const docRef = doc(db, 'event_discussions', questionId);
    await updateDoc(docRef, {
      answers: question.answers,
      isResolved: question.isResolved
    });
  } catch (err) {
    console.warn('Firestore answer save warning:', err.message);
  }

  return question;
}

/**
 * Toggle upvote on a question
 */
export async function toggleUpvoteQuestion(eventId, questionId, userId) {
  if (!userId) return null;

  const current = getCachedDiscussionsSync(eventId);
  const target = current.find((q) => q.id === questionId);
  if (!target) return null;

  const upvotes = Array.isArray(target.upvotes) ? [...target.upvotes] : [];
  const hasUpvoted = upvotes.includes(userId);

  if (hasUpvoted) {
    target.upvotes = upvotes.filter((uid) => uid !== userId);
  } else {
    target.upvotes = [...upvotes, userId];
  }

  saveDiscussionsToCache(eventId, current);

  try {
    const docRef = doc(db, 'event_discussions', questionId);
    await updateDoc(docRef, {
      upvotes: target.upvotes
    });
  } catch (err) {
    console.warn('Firestore upvote update warning:', err.message);
  }

  return target;
}
