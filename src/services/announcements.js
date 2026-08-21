import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  query, 
  doc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { isUserAdmin } from './auth';

const LOCAL_NOTICES_KEY = 'ep_cached_announcements';

// IndexedDB Helper for Large Notice Attachments Backup
function openNoticeDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('EP_NoticeFiles', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files');
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

export async function storeFileInIndexedDB(file) {
  const db = await openNoticeDB();
  if (!db) return null;
  const key = 'idb_notice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      store.put(file, key);
      tx.oncomplete = () => resolve('idb:' + key);
      tx.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

export async function getFileFromIndexedDB(idbKey) {
  if (!idbKey || !idbKey.startsWith('idb:')) return null;
  const key = idbKey.replace('idb:', '');
  const db = await openNoticeDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Save notice attachment to Firestore (Safely splits >700KB files into 2 <750KB docs)
 */
export async function uploadNoticeAttachment(file, noticeId) {
  if (!file) return null;

  const targetId = noticeId || ('notice_' + Date.now());

  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

  if (!dataUrl) return null;

  let idbKey = null;
  try {
    idbKey = await storeFileInIndexedDB(file);
  } catch (e) {}

  const HALF = 700000; // ~525KB base64 chunk
  if (dataUrl.length <= HALF) {
    return {
      noticeId: targetId,
      name: file.name,
      type: file.type || 'application/pdf',
      size: file.size,
      dataUrl,
      isSplit: false,
      idbKey
    };
  }

  // File > 700KB (e.g. 1.1MB PDF = 1.5MB base64): Split into 2 safe docs (<750KB each) to satisfy Firestore 1MB limit
  const part1 = dataUrl.slice(0, HALF);
  const part2 = dataUrl.slice(HALF);

  try {
    await setDoc(doc(db, 'announcements', `${targetId}_part2`), {
      isPart2: true,
      noticeId: targetId,
      data: part2
    });
  } catch (err) {
    console.warn('Part 2 save warning:', err.message);
  }

  return {
    noticeId: targetId,
    name: file.name,
    type: file.type || 'application/pdf',
    size: file.size,
    dataUrl: part1,
    hasPart2: true,
    isSplit: true,
    idbKey
  };
}

/**
 * Fetch notice attachment data for viewing (reassembles part 1 + part 2 if split)
 */
export async function fetchNoticeAttachmentData(noticeId, attachmentMeta) {
  if (!attachmentMeta) return null;

  let fullDataUrl = attachmentMeta.dataUrl || attachmentMeta.url || null;
  if (fullDataUrl && fullDataUrl.startsWith('idb:')) {
    fullDataUrl = null;
  }

  const targetId = noticeId || attachmentMeta.noticeId;

  // If file was split across 2 docs, fetch part 2 and combine
  if (attachmentMeta.hasPart2 && targetId) {
    try {
      const p2Snap = await getDoc(doc(db, 'announcements', `${targetId}_part2`));
      if (p2Snap && p2Snap.exists() && p2Snap.data()?.data) {
        if (!fullDataUrl && attachmentMeta.dataUrl && !attachmentMeta.dataUrl.startsWith('idb:')) {
          fullDataUrl = attachmentMeta.dataUrl;
        }
        if (fullDataUrl) {
          fullDataUrl += p2Snap.data().data;
        }
      }
    } catch (e) {
      console.warn('Fetch part 2 warning:', e);
    }
  }

  // Local IDB Fallback
  if (!fullDataUrl && (attachmentMeta.idbKey || (attachmentMeta.dataUrl && attachmentMeta.dataUrl.startsWith('idb:')))) {
    const key = attachmentMeta.idbKey || attachmentMeta.dataUrl;
    try {
      const file = await getFileFromIndexedDB(key);
      if (file) {
        return await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(file);
        });
      }
    } catch (e) {}
  }

  return fullDataUrl;
}

function getLocalNotices() {
  try {
    const raw = localStorage.getItem(LOCAL_NOTICES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLocalNotices(list) {
  try {
    const cleanList = (list || []).map(item => {
      if (item && item.attachment && item.attachment.dataUrl) {
        return {
          ...item,
          attachment: {
            ...item.attachment,
            dataUrl: null
          }
        };
      }
      return item;
    });
    localStorage.setItem(LOCAL_NOTICES_KEY, JSON.stringify(cleanList));
  } catch (e) {
    console.warn('Local notices cache warning:', e);
  }
}

export function getCachedAnnouncementsSync() {
  return getLocalNotices().filter(d => !d.isPart2 && !d.isNoticeChunk && !d.id?.includes('_part2') && !d.id?.includes('_chunk_'));
}

/**
 * Fetch all campus announcements
 */
export async function getAnnouncements() {
  try {
    const q = query(collection(db, 'announcements'));
    const snap = await Promise.race([
      getDocs(q),
      new Promise(res => setTimeout(() => res(null), 3000))
    ]);

    if (snap && snap.docs) {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => !d.isPart2 && !d.isNoticeChunk && !d.id?.includes('_part2') && !d.id?.includes('_chunk_'));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      saveLocalNotices(list);
      return list;
    }
    return getLocalNotices().filter(d => !d.isPart2 && !d.isNoticeChunk && !d.id?.includes('_part2') && !d.id?.includes('_chunk_'));
  } catch (err) {
    return getLocalNotices().filter(d => !d.isPart2 && !d.isNoticeChunk && !d.id?.includes('_part2') && !d.id?.includes('_chunk_'));
  }
}

/**
 * Post an official announcement (Admin only)
 */
export async function createAnnouncement({ id, title, message, priority, targetDept, link, attachment, user }) {
  if (!user || !isUserAdmin(user)) {
    return { success: false, error: 'Only administrators can broadcast campus notices.' };
  }

  const noticeId = id || ('notice_' + Date.now());
  const noticeData = {
    id: noticeId,
    title: title.trim(),
    message: message.trim(),
    priority: priority || '📢 Campus Notice',
    targetDept: targetDept || 'All Departments',
    link: (link || '').trim(),
    attachment: attachment || null,
    postedBy: user.name || 'University Administration',
    adminId: user.uid,
    createdAt: new Date().toISOString()
  };

  // 1. Save to Cloud Firestore First
  try {
    await setDoc(doc(db, 'announcements', noticeId), noticeData);
  } catch (err) {
    console.warn('Firestore setDoc announcement warning:', err.message);
  }

  // 2. Update local storage cache second
  const current = getLocalNotices();
  current.unshift(noticeData);
  saveLocalNotices(current);

  return { success: true, announcement: noticeData };
}

/**
 * Delete an announcement (Admin only)
 */
export async function deleteAnnouncement(announcementId, user) {
  if (!user || !isUserAdmin(user)) {
    return { success: false, error: 'Unauthorized.' };
  }

  const current = getLocalNotices().filter(n => n.id !== announcementId);
  saveLocalNotices(current);

  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
    deleteDoc(doc(db, 'announcements', `${announcementId}_part2`)).catch(() => {});
    return { success: true };
  } catch (err) {
    return { success: true };
  }
}
