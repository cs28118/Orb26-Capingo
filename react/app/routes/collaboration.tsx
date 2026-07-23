import { useCallback, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Link } from 'react-router';
import './collaboration.css';
import { checkAndUnlockAchievements } from '../utils/achievementCheck';

type Suggestion = {
  uid: string;
  username: string;
  profilePic: string;
  partnerCode?: string;
  sharedSubjects: string[];
  matchScore: number;
};

type PartnerEntry = {
  partnershipId?: string;
  uid: string;
  username: string;
  profilePic: string;
  partnerCode?: string;
  sharedSubjects: string[];
  status: string;
  requestedBy?: string;
  updatedAt?: string;
};

type PublicProfile = {
  uid: string;
  username: string;
  profilePic: string;
  partnerCode?: string;
  subjects?: string[];
  manualSubjects?: string[];
};

function getApiBase() {
  const url = import.meta.env.VITE_API_URL;
  return url ? url.replace(/\/$/, '') : '';
}

export default function Collaboration() {
  const [firebaseUser, setFirebaseUser] = useState<{ uid: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [partnerCode, setPartnerCode] = useState('');
  const [syncedSubjects, setSyncedSubjects] = useState<string[]>([]);
  const [manualSubjects, setManualSubjects] = useState<string[]>([]);
  const [openToPartners, setOpenToPartners] = useState(true);
  const [newSubject, setNewSubject] = useState('');

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<PartnerEntry[]>([]);
  const [incoming, setIncoming] = useState<PartnerEntry[]>([]);
  const [outgoing, setOutgoing] = useState<PartnerEntry[]>([]);

  const [lookupInput, setLookupInput] = useState('');
  const [lookupPreview, setLookupPreview] = useState<PublicProfile | null>(null);
  const [lookupError, setLookupError] = useState('');

  const loadData = useCallback(async (uid: string) => {
    const base = getApiBase();
    const [profileRes, partnersRes, suggestionsRes] = await Promise.all([
      fetch(`${base}/api/profile/${uid}`),
      fetch(`${base}/api/partners/${uid}`),
      fetch(`${base}/api/partners/suggestions/${uid}`),
    ]);

    if (profileRes.ok) {
      const profile = await profileRes.json();
      setPartnerCode(profile.partnerCode || '');
      setSyncedSubjects(profile.subjects || []);
      setManualSubjects(profile.manualSubjects || []);
      setOpenToPartners(profile.openToPartners !== false);
    }

    if (partnersRes.ok) {
      const data = await partnersRes.json();
      setAccepted(data.accepted || []);
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    }

    if (suggestionsRes.ok) {
      const data = await suggestionsRes.json();
      setSuggestions(data.suggestions || []);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        await loadData(user.uid);
      } catch {
        setError('Could not load collaboration data.');
      } finally {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  const saveManualSubjects = async (subjects: string[], open?: boolean) => {
    if (!firebaseUser) return;
    const res = await fetch(`${getApiBase()}/api/partners/subjects/${firebaseUser.uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manualSubjects: subjects,
        openToPartners: open ?? openToPartners,
      }),
    });
    if (!res.ok) throw new Error('Failed to save subjects');
    const data = await res.json();
    setManualSubjects(data.manualSubjects || []);
    if (typeof data.openToPartners === 'boolean') setOpenToPartners(data.openToPartners);
    await loadData(firebaseUser.uid);
  };

  const handleAddManualSubject = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (manualSubjects.some((s) => s.toLowerCase() === lower)) {
      setNewSubject('');
      return;
    }
    try {
      await saveManualSubjects([...manualSubjects, trimmed]);
      setNewSubject('');
      setSuccess('Subject added.');
    } catch {
      setError('Could not save subject.');
    }
  };

  const handleRemoveManualSubject = async (subject: string) => {
    try {
      await saveManualSubjects(manualSubjects.filter((s) => s !== subject));
      setSuccess('Subject removed.');
    } catch {
      setError('Could not remove subject.');
    }
  };

  const handleToggleOpen = async () => {
    const next = !openToPartners;
    try {
      await saveManualSubjects(manualSubjects, next);
      setOpenToPartners(next);
    } catch {
      setError('Could not update visibility.');
    }
  };

  const handleCopyCode = async () => {
    if (!partnerCode) return;
    try {
      await navigator.clipboard.writeText(partnerCode);
      setSuccess('Partner code copied!');
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const handleLookup = async () => {
    setLookupError('');
    setLookupPreview(null);
    const input = lookupInput.trim().toUpperCase();
    if (!input) return;

    try {
      let preview: PublicProfile | null = null;

      if (input.startsWith('CAPY-')) {
        const res = await fetch(`${getApiBase()}/api/partners/code/${encodeURIComponent(input)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Not found');
        preview = data;
      } else if (input.length > 20) {
        preview = {
          uid: input,
          username: 'User',
          profilePic: '/assets/profile-placeholder.png',
        };
        const res = await fetch(`${getApiBase()}/api/profile/${input}`);
        if (res.ok) {
          const profile = await res.json();
          preview = {
            uid: profile.firebaseUid,
            username: profile.username,
            profilePic: profile.profilePic,
            partnerCode: profile.partnerCode,
          };
        }
      } else {
        setLookupError('Enter a CAPY-XXXX code or Firebase UID.');
        return;
      }

      if (preview && preview.uid === firebaseUser?.uid) {
        setLookupError('That is your own code.');
        return;
      }

      setLookupPreview(preview);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'User not found');
    }
  };

  const sendRequest = async (targetUid?: string, code?: string) => {
    if (!firebaseUser) return;
    setError('');
    setSuccess('');
    try {
      const body: Record<string, string> = { requesterUid: firebaseUser.uid };
      if (targetUid) body.targetUid = targetUid;
      if (code) body.partnerCode = code;

      const res = await fetch(`${getApiBase()}/api/partners/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setSuccess('Partner request sent!');
      setLookupPreview(null);
      setLookupInput('');
      await loadData(firebaseUser.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send request');
    }
  };

  const acceptRequest = async (partnerUid: string) => {
    if (!firebaseUser) return;
    try {
      const res = await fetch(`${getApiBase()}/api/partners/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, partnerUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Accept failed');
      setSuccess('Partner request accepted!');
      await loadData(firebaseUser.uid);
      
      if (data.profile) {
        const newlyUnlockedIds = checkAndUnlockAchievements(data.profile);
        if (newlyUnlockedIds.length > 0) {
          await fetch(`${getApiBase()}/api/profile/unlock-achievements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: firebaseUser.uid, newAchievementIds: newlyUnlockedIds }),
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept request');
    }
  };

  const declineRequest = async (partnerUid: string) => {
    if (!firebaseUser) return;
    try {
      const res = await fetch(`${getApiBase()}/api/partners/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, partnerUid }),
      });
      if (!res.ok) throw new Error('Decline failed');
      await loadData(firebaseUser.uid);
    } catch {
      setError('Could not decline request.');
    }
  };

  const removePartner = async (partnerUid: string) => {
    if (!firebaseUser) return;
    try {
      const res = await fetch(
        `${getApiBase()}/api/partners/${firebaseUser.uid}/${partnerUid}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Remove failed');
      setSuccess('Partner removed.');
      await loadData(firebaseUser.uid);
    } catch {
      setError('Could not remove partner.');
    }
  };

  if (isLoading) {
    return (
      <div className="collaboration-page">
        <div className="collab-loading">Loading study partners...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="collaboration-page">
        <p>Please sign in to find study partners.</p>
      </div>
    );
  }

  return (
    <div className="collaboration-page">
      <header className="collaboration-header">
        <div>
          <h1>Study Partner Finder</h1>
          <p>Match with students studying the same subjects. Tag subjects on your <Link to="/home/timetable">timetable</Link> to get suggestions.</p>
        </div>
        {partnerCode && (
          <div className="partner-code-box">
            <div>
              <div className="partner-code-label">Your partner code</div>
              <div className="partner-code-value">{partnerCode}</div>
            </div>
            <button type="button" className="collab-btn" onClick={handleCopyCode}>
              Copy
            </button>
          </div>
        )}
      </header>

      {error && <div className="collab-error">{error}</div>}
      {success && <div className="collab-success">{success}</div>}

      <section className="collab-panel collab-full-width">
        <h2>Your subjects</h2>
        <div className="subject-section">
          <h3>From timetable (synced)</h3>
          <div className="subject-chips">
            {syncedSubjects.length === 0 ? (
              <span className="collab-empty">Add subjects to timetable tasks to sync here.</span>
            ) : (
              syncedSubjects.map((s) => (
                <span key={s} className="subject-chip subject-chip-synced">{s}</span>
              ))
            )}
          </div>
        </div>
        <div className="subject-section">
          <h3>Manual subjects</h3>
          <div className="subject-chips">
            {manualSubjects.map((s) => (
              <span key={s} className="subject-chip subject-chip-manual">
                {s}
                <button type="button" onClick={() => handleRemoveManualSubject(s)} aria-label={`Remove ${s}`}>×</button>
              </span>
            ))}
          </div>
          <div className="manual-subject-row">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Add a subject e.g. Economics"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddManualSubject())}
            />
            <button type="button" className="collab-btn collab-btn-primary" onClick={handleAddManualSubject}>
              Add
            </button>
          </div>
        </div>
        <label className="open-toggle">
          <input type="checkbox" checked={openToPartners} onChange={handleToggleOpen} />
          Show me in partner suggestions
        </label>
      </section>

      <div className="collab-grid">
        <section className="collab-panel">
          <h2>Suggested partners</h2>
          {suggestions.length === 0 ? (
            <p className="collab-empty">No suggestions yet. Add subjects to your timetable or manual list above.</p>
          ) : (
            suggestions.map((s) => (
              <div key={s.uid} className="partner-card">
                <img src={s.profilePic} alt="" />
                <div className="partner-card-body">
                  <div className="partner-card-name">{s.username}</div>
                  <div className="partner-card-meta">{s.matchScore}% match · {s.partnerCode}</div>
                  <div className="subject-chips">
                    {s.sharedSubjects.map((sub) => (
                      <span key={sub} className="subject-chip subject-chip-shared">{sub}</span>
                    ))}
                  </div>
                  <div className="partner-card-actions">
                    <button
                      type="button"
                      className="collab-btn collab-btn-primary"
                      onClick={() => sendRequest(s.uid)}
                    >
                      Send request
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="collab-panel">
          <h2>Add partner</h2>
          <div className="add-partner-form">
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="CAPY-XXXX or Firebase UID"
            />
            <button type="button" className="collab-btn" onClick={handleLookup}>
              Look up
            </button>
            {lookupError && <div className="collab-error">{lookupError}</div>}
            {lookupPreview && (
              <div className="partner-card">
                <img src={lookupPreview.profilePic} alt="" />
                <div className="partner-card-body">
                  <div className="partner-card-name">{lookupPreview.username}</div>
                  {lookupPreview.partnerCode && (
                    <div className="partner-card-meta">{lookupPreview.partnerCode}</div>
                  )}
                  <button
                    type="button"
                    className="collab-btn collab-btn-primary"
                    onClick={() =>
                      sendRequest(
                        lookupPreview.uid,
                        lookupInput.trim().toUpperCase().startsWith('CAPY-')
                          ? lookupInput.trim().toUpperCase()
                          : undefined
                      )
                    }
                  >
                    Send request
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="collab-panel collab-full-width">
        <h2>My partners</h2>
        {accepted.length === 0 ? (
          <p className="collab-empty">No study partners yet.</p>
        ) : (
          accepted.map((p) => (
            <div key={p.uid} className="partner-card">
              <img src={p.profilePic} alt="" />
              <div className="partner-card-body">
                <div className="partner-card-name">{p.username}</div>
                <div className="subject-chips">
                  {p.sharedSubjects.map((s) => (
                    <span key={s} className="subject-chip subject-chip-shared">{s}</span>
                  ))}
                </div>
                <div className="partner-card-actions">
                  <button type="button" className="collab-btn collab-btn-danger" onClick={() => removePartner(p.uid)}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <section className="collab-panel collab-full-width">
          <h2>Pending requests</h2>
          {incoming.map((p) => (
            <div key={p.uid} className="partner-card">
              <img src={p.profilePic} alt="" />
              <div className="partner-card-body">
                <div className="partner-card-name">{p.username} wants to partner</div>
                <div className="partner-card-actions">
                  <button type="button" className="collab-btn collab-btn-primary" onClick={() => acceptRequest(p.uid)}>
                    Accept
                  </button>
                  <button type="button" className="collab-btn" onClick={() => declineRequest(p.uid)}>
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
          {outgoing.map((p) => (
            <div key={p.uid} className="partner-card">
              <img src={p.profilePic} alt="" />
              <div className="partner-card-body">
                <div className="partner-card-name">{p.username}</div>
                <div className="partner-card-meta">Request sent — waiting for response</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
