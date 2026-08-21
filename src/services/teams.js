import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';

const LOCAL_TEAMS_KEY = 'ep_cached_teams';

export function getCachedTeamsSync(eventId = null) {
  try {
    const raw = localStorage.getItem(LOCAL_TEAMS_KEY);
    const teams = raw ? JSON.parse(raw) : [];
    if (eventId) return teams.filter(t => t.eventId === eventId);
    return teams;
  } catch (e) {
    return [];
  }
}

function saveCachedTeams(teams) {
  try {
    localStorage.setItem(LOCAL_TEAMS_KEY, JSON.stringify(teams));
  } catch (e) {}
}

export async function getEventTeams(eventId = null) {
  try {
    let q;
    if (eventId) {
      q = query(collection(db, 'teams'), where('eventId', '==', eventId));
    } else {
      q = query(collection(db, 'teams'));
    }

    const snap = await Promise.race([
      getDocs(q),
      new Promise((res) => setTimeout(() => res(null), 3000))
    ]);

    if (snap) {
      const teams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveCachedTeams(teams);
      return teams;
    }
    return getCachedTeamsSync(eventId);
  } catch (err) {
    console.warn('Teams fetch notice:', err.message);
    return getCachedTeamsSync(eventId);
  }
}

export async function createTeamPost({ 
  eventId, 
  eventTitle, 
  teamName, 
  leaderId, 
  leaderName, 
  leaderEmail, 
  leaderDept, 
  leaderYear, 
  requiredRoles, 
  skills, 
  contactPhone, 
  contactInstagram,
  contactLinkedin,
  contactEmail,
  description 
}) {
  try {
    const cleanInsta = (contactInstagram || '').trim().replace(/^@/, '');
    const cleanLinkedin = (contactLinkedin || '').trim();
    const postData = {
      eventId: eventId || 'general',
      eventTitle: eventTitle || 'Campus Hackathon / Contest',
      teamName: teamName.trim(),
      leaderId,
      leaderName,
      leaderEmail,
      leaderDept,
      leaderYear,
      requiredRoles: Array.isArray(requiredRoles) ? requiredRoles : requiredRoles.split(',').map(r => r.trim()),
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
      contactPhone: (contactPhone || '').trim(),
      contactInstagram: cleanInsta,
      contactLinkedin: cleanLinkedin,
      contactEmail: (contactEmail || leaderEmail || '').trim(),
      description: (description || '').trim(),
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'teams'), postData);
    const newTeam = { id: docRef.id, ...postData };

    // Update local cache
    const current = getCachedTeamsSync();
    current.unshift(newTeam);
    saveCachedTeams(current);

    return { success: true, team: newTeam };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteTeamPost(teamId) {
  try {
    await deleteDoc(doc(db, 'teams', teamId));
    const current = getCachedTeamsSync().filter(t => t.id !== teamId);
    saveCachedTeams(current);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
