import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { io, Socket } from 'socket.io-client';
import './space.css';

type Friend = {
  uid: string;
  username: string;
  profilePic: string;
};

type AcceptedPartnerResponse = {
  uid: string;
  username: string;
  profilePic: string;
};

type RoomSummary = {
  roomId: string;
  roomCode: string;
  type: 'direct' | 'group';
  name: string;
  avatar: string | null;
  memberCount: number;
  isAdmin: boolean;
  lastMessage: { text: string; senderUid: string; createdAt: string } | null;
  updatedAt: string;
};

type RoomMember = {
  uid: string;
  username: string;
  profilePic: string;
  role: 'admin' | 'member';
};

type ChatMessage = {
  _id: string;
  roomId: string;
  senderUid: string;
  text: string;
  createdAt: string;
};

type Announcement = {
  _id: string;
  roomId: string;
  authorUid: string;
  text: string;
  createdAt: string;
};

type Resource = {
  _id: string;
  roomId: string;
  addedByUid: string;
  title: string;
  url: string;
  description: string;
  createdAt: string;
};

function getApiBase() {
  const url = import.meta.env.VITE_API_URL;
  return url ? url.replace(/\/$/, '') : '';
}

export default function Space() {
  const [firebaseUser, setFirebaseUser] = useState<{ uid: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [friends, setFriends] = useState<Friend[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomLabel, setActiveRoomLabel] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const joinedRoomIdsRef = useRef<Set<string>>(new Set());
  
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);

  const [activeTab, setActiveTab] = useState<'chat' | 'announcements' | 'resources'>('chat');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceTitleInput, setResourceTitleInput] = useState('');
  const [resourceUrlInput, setResourceUrlInput] = useState('');
  const [resourceDescInput, setResourceDescInput] = useState('');

  const activeRoom = rooms.find((r) => r.roomId === activeRoomId);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  const loadSidebar = useCallback(async (uid: string) => {
    const base = getApiBase();
    const [partnersRes, roomsRes] = await Promise.all([
      fetch(`${base}/api/partners/${uid}`),
      fetch(`${base}/api/rooms/${uid}`),
    ]);
    if (partnersRes.ok) {
      const data = await partnersRes.json();
      setFriends((data.accepted || []).map((p: AcceptedPartnerResponse) => ({ uid: p.uid, username: p.username, profilePic: p.profilePic })));
    }
    if (roomsRes.ok) {
      const data = await roomsRes.json();
      setRooms(data.rooms || []);
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
        await loadSidebar(user.uid);
      } catch {
        setError('Could not load collaboration space.');
      } finally {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadSidebar]);

  useEffect(() => {
    if (!firebaseUser) return;

    const socket = io(getApiBase(), {
      auth: { uid: firebaseUser.uid },
    });
    socketRef.current = socket;
    joinedRoomIdsRef.current = new Set();

    socket.on('new_message', (message: ChatMessage) => {
      const incomingRoomId = String(message.roomId);

      if (incomingRoomId === activeRoomIdRef.current) {
        setMessages((prev) => [...prev, message]);
      }

      setRooms((prev) => {
        const next = prev.map((r) =>
          r.roomId === incomingRoomId
            ? { ...r, lastMessage: { text: message.text, senderUid: message.senderUid, createdAt: message.createdAt }, updatedAt: message.createdAt }
            : r
        );
        return [...next].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    });

    socket.on('connect_error', () => {
      setError('Live chat connection failed. Messages may be delayed.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [firebaseUser]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    rooms.forEach((r) => {
      if (!joinedRoomIdsRef.current.has(r.roomId)) {
        socket.emit('join_room', r.roomId);
        joinedRoomIdsRef.current.add(r.roomId);
      }
    });
  }, [rooms]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinRoomSocket = (roomId: string) => {
    const socket = socketRef.current;
    if (socket && !joinedRoomIdsRef.current.has(roomId)) {
      socket.emit('join_room', roomId);
      joinedRoomIdsRef.current.add(roomId);
    }
  };

  const openFriendChat = async (friend: Friend) => {
    if (!firebaseUser) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, partnerUid: friend.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open chat');
      await loadSidebar(firebaseUser.uid);
      await openRoom(data.roomId, friend.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open chat');
    }
  };

  const handleCreateRoom = async () => {
    if (!firebaseUser) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, name: roomNameInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create room');
      setShowCreateModal(false);
      setRoomNameInput('');
      await loadSidebar(firebaseUser.uid);
      await openRoom(data.roomId, data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create room');
    }
  };

  const handleJoinRoom = async () => {
    if (!firebaseUser) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, roomCode: joinCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join room');
      setShowJoinModal(false);
      setJoinCodeInput('');
      await loadSidebar(firebaseUser.uid);
      await openRoom(data.roomId, 'Study room');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room');
    }
  };

  const handleInviteFriend = async (targetUid: string) => {
    if (!firebaseUser || !activeRoomId) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${activeRoomId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, targetUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not invite partner');
      setShowInviteModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite partner');
    }
  };

  const loadMembers = useCallback(async (roomId: string) => {
    if (!firebaseUser) return;
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${roomId}/members?uid=${firebaseUser.uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load members');
      setRoomMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load members');
    }
  }, [firebaseUser]);

  const loadAnnouncements = useCallback(async (roomId: string) => {
    if (!firebaseUser) return;
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${roomId}/announcements?uid=${firebaseUser.uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load announcements');
      setAnnouncements(data.announcements || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load announcements');
    }
  }, [firebaseUser]);

  const loadResources = useCallback(async (roomId: string) => {
    if (!firebaseUser) return;
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${roomId}/resources?uid=${firebaseUser.uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load resources');
      setResources(data.resources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load resources');
    }
  }, [firebaseUser]);

  const openRoom = useCallback(async (roomId: string, label: string) => {
    if (!firebaseUser) return;
    setActiveRoomId(roomId);
    setActiveRoomLabel(label);
    setMessages([]);
    setActiveTab('chat');
    joinRoomSocket(roomId);

    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${roomId}/messages?uid=${firebaseUser.uid}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      setError('Could not load message history.');
    }

    await loadMembers(roomId);
  }, [firebaseUser, loadMembers]);

  const handleOpenMembers = async () => {
    if (!activeRoomId) return;
    await loadMembers(activeRoomId);
    setShowMembersModal(true);
  };

  const handleLeaveRoom = async () => {
    if (!firebaseUser || !activeRoomId) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${activeRoomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not leave room');
      setActiveRoomId(null);
      setActiveRoomLabel('');
      setMessages([]);
      await loadSidebar(firebaseUser.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave room');
    }
  };

  const handleKickMember = async (targetUid: string) => {
    if (!firebaseUser || !activeRoomId) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${activeRoomId}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, targetUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove member');
      await loadMembers(activeRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
    }
  };

  const handlePromoteMember = async (targetUid: string) => {
    if (!firebaseUser || !activeRoomId) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${activeRoomId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, targetUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not promote member');
      await loadMembers(activeRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not promote member');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId || !messageInput.trim() || !socketRef.current) return;
    const text = messageInput.trim();
    setMessageInput('');

    socketRef.current.emit('send_message', { roomId: activeRoomId, text }, (response: { error?: string }) => {
      if (response?.error) setError(response.error);
    });
  };

  const getSenderLabel = (uid: string) => {
    if (uid === firebaseUser?.uid) return 'You';
    const member = roomMembers.find((m) => m.uid === uid);
    if (member) return member.username;
    return friends.find((f) => f.uid === uid)?.username || 'Member';
  };

  const handleTabChange = async (tab: 'chat' | 'announcements' | 'resources') => {
    setActiveTab(tab);
    if (!activeRoomId) return;
    if (tab === 'announcements') await loadAnnouncements(activeRoomId);
    if (tab === 'resources') await loadResources(activeRoomId);
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !activeRoomId || !announcementInput.trim()) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${activeRoomId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid, text: announcementInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not post announcement');
      setAnnouncementInput('');
      await loadAnnouncements(activeRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post announcement');
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!firebaseUser || !activeRoomId) return;
    setError('');
    try {
      const res = await fetch(
        `${getApiBase()}/api/rooms/${activeRoomId}/announcements/${announcementId}?uid=${firebaseUser.uid}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete announcement');
      await loadAnnouncements(activeRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete announcement');
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !activeRoomId || !resourceTitleInput.trim() || !resourceUrlInput.trim()) return;
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/rooms/${activeRoomId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          title: resourceTitleInput.trim(),
          url: resourceUrlInput.trim(),
          description: resourceDescInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add resource');
      setResourceTitleInput('');
      setResourceUrlInput('');
      setResourceDescInput('');
      await loadResources(activeRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add resource');
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!firebaseUser || !activeRoomId) return;
    setError('');
    try {
      const res = await fetch(
        `${getApiBase()}/api/rooms/${activeRoomId}/resources/${resourceId}?uid=${firebaseUser.uid}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete resource');
      await loadResources(activeRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete resource');
    }
  };

  if (isLoading) {
    return (
      <div className="space-page">
        <div className="space-loading">Loading collaboration space...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="space-page">
        <p>Please sign in to use the collaboration space.</p>
      </div>
    );
  }

  return (
    <div className="space-page">
      {error && <div className="space-error">{error}</div>}

      <aside className="space-sidebar">
        <div className="space-sidebar-section">
          <div className="space-sidebar-header">
            <h3>Friends</h3>
          </div>
          {friends.length === 0 ? (
            <p className="space-empty">No study partners yet. Add some in the Partner Finder.</p>
          ) : (
            friends.map((f) => (
              <button
                key={f.uid}
                type="button"
                className={`space-list-item ${activeRoom?.type === 'direct' && activeRoomLabel === f.username ? 'active' : ''}`}
                onClick={() => openFriendChat(f)}
              >
                <img src={f.profilePic} alt="" />
                <span>{f.username}</span>
              </button>
            ))
          )}
        </div>

        <div className="space-sidebar-section">
          <div className="space-sidebar-header">
            <h3>Study rooms</h3>
            <div className="space-sidebar-actions">
              <button type="button" className="space-icon-btn" title="Create room" onClick={() => setShowCreateModal(true)}>+</button>
              <button type="button" className="space-icon-btn" title="Join room" onClick={() => setShowJoinModal(true)}>#</button>
            </div>
          </div>
          {rooms.filter((r) => r.type === 'group').length === 0 ? (
            <p className="space-empty">No study rooms yet. Create or join one.</p>
          ) : (
            rooms.filter((r) => r.type === 'group').map((r) => (
              <button
                key={r.roomId}
                type="button"
                className={`space-list-item ${activeRoomId === r.roomId ? 'active' : ''}`}
                onClick={() => openRoom(r.roomId, r.name)}
              >
                <span className="space-room-avatar">#</span>
                <span>{r.name}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="space-chat-panel">
        {!activeRoomId ? (
          <div className="space-chat-placeholder">Select a friend or study room to start chatting.</div>
        ) : (
          <>
            <div className="space-chat-header">
              <h2>{activeRoomLabel}</h2>
              {activeRoom?.type === 'group' && (
                <div className="space-chat-header-actions">
                  <span className="space-room-code">{activeRoom.roomCode}</span>
                  <button type="button" className="collab-btn" onClick={handleOpenMembers}>Members</button>
                  <button type="button" className="collab-btn" onClick={() => setShowInviteModal(true)}>Invite friend</button>
                  <button type="button" className="collab-btn collab-btn-danger" onClick={handleLeaveRoom}>Leave</button>
                </div>
              )}
            </div>

            {activeRoom?.type === 'group' && (
              <div className="space-tab-bar">
                <button type="button" className={`space-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => handleTabChange('chat')}>Chat</button>
                <button type="button" className={`space-tab ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => handleTabChange('announcements')}>Dashboard</button>
                <button type="button" className={`space-tab ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => handleTabChange('resources')}>Resources</button>
              </div>
            )}

            {activeTab === 'chat' && (
              <>
                <div className="space-messages">
                  {messages.map((m) => (
                    <div key={m._id} className={`space-message ${m.senderUid === firebaseUser.uid ? 'mine' : ''}`}>
                      {activeRoom?.type === 'group' && m.senderUid !== firebaseUser.uid && (
                        <div className="space-message-sender">{getSenderLabel(m.senderUid)}</div>
                      )}
                      <div className="space-message-bubble">{m.text}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form className="space-composer" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                  />
                  <button type="submit" className="collab-btn collab-btn-primary">Send</button>
                </form>
              </>
            )}

            {activeTab === 'announcements' && activeRoom?.type === 'group' && (
              <div className="space-tab-panel">
                {activeRoom.isAdmin && (
                  <form className="space-announcement-form" onSubmit={handlePostAnnouncement}>
                    <textarea
                      value={announcementInput}
                      onChange={(e) => setAnnouncementInput(e.target.value)}
                      placeholder="Post an announcement to the room..."
                      rows={3}
                    />
                    <button type="submit" className="collab-btn collab-btn-primary">Post</button>
                  </form>
                )}
                <div className="space-announcement-list">
                  {announcements.length === 0 ? (
                    <p className="space-empty">No announcements yet.</p>
                  ) : (
                    announcements.map((a) => (
                      <div key={a._id} className="space-announcement-card">
                        <div className="space-announcement-meta">
                          <span>{getSenderLabel(a.authorUid)}</span>
                          <span>{new Date(a.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="space-announcement-text">{a.text}</p>
                        {activeRoom.isAdmin && (
                          <button type="button" className="space-mini-btn danger" onClick={() => handleDeleteAnnouncement(a._id)}>Delete</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'resources' && activeRoom?.type === 'group' && (
              <div className="space-tab-panel">
                <form className="space-resource-form" onSubmit={handleAddResource}>
                  <input
                    type="text"
                    value={resourceTitleInput}
                    onChange={(e) => setResourceTitleInput(e.target.value)}
                    placeholder="Title, e.g. Chapter 5 notes"
                  />
                  <input
                    type="url"
                    value={resourceUrlInput}
                    onChange={(e) => setResourceUrlInput(e.target.value)}
                    placeholder="Drive/OneDrive link (https://...)"
                  />
                  <input
                    type="text"
                    value={resourceDescInput}
                    onChange={(e) => setResourceDescInput(e.target.value)}
                    placeholder="Optional description"
                  />
                  <button type="submit" className="collab-btn collab-btn-primary">Add resource</button>
                </form>
                <div className="space-resource-list">
                  {resources.length === 0 ? (
                    <p className="space-empty">No shared resources yet.</p>
                  ) : (
                    resources.map((r) => (
                      <div key={r._id} className="space-resource-card">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="space-resource-title">{r.title}</a>
                        {r.description && <p className="space-resource-desc">{r.description}</p>}
                        <div className="space-resource-meta">
                          <span>Added by {getSenderLabel(r.addedByUid)}</span>
                          {(r.addedByUid === firebaseUser.uid || activeRoom.isAdmin) && (
                            <button type="button" className="space-mini-btn danger" onClick={() => handleDeleteResource(r._id)}>Remove</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {showCreateModal && (
        <div className="space-modal-dimmer" onClick={() => setShowCreateModal(false)}>
          <div className="space-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create study room</h2>
            <input type="text" value={roomNameInput} onChange={(e) => setRoomNameInput(e.target.value)} placeholder="e.g. Biology Finals Prep" />
            <div className="space-modal-actions">
              <button type="button" className="collab-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button type="button" className="collab-btn collab-btn-primary" onClick={handleCreateRoom}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="space-modal-dimmer" onClick={() => setShowJoinModal(false)}>
          <div className="space-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Join study room</h2>
            <input type="text" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="ROOM-XXXXXX" />
            <div className="space-modal-actions">
              <button type="button" className="collab-btn" onClick={() => setShowJoinModal(false)}>Cancel</button>
              <button type="button" className="collab-btn collab-btn-primary" onClick={handleJoinRoom}>Join</button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="space-modal-dimmer" onClick={() => setShowInviteModal(false)}>
          <div className="space-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Invite a study partner</h2>
            {friends.length === 0 ? (
              <p className="space-empty">You have no study partners to invite yet.</p>
            ) : (
              friends.map((f) => (
                <button key={f.uid} type="button" className="space-list-item" onClick={() => handleInviteFriend(f.uid)}>
                  <img src={f.profilePic} alt="" />
                  <span>{f.username}</span>
                </button>
              ))
            )}
            <div className="space-modal-actions">
              <button type="button" className="collab-btn" onClick={() => setShowInviteModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showMembersModal && (
        <div className="space-modal-dimmer" onClick={() => setShowMembersModal(false)}>
          <div className="space-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Room members</h2>
            {roomMembers.map((m) => (
              <div key={m.uid} className="space-member-row">
                <img src={m.profilePic} alt="" />
                <span className="space-member-name">
                  {m.username}{m.uid === firebaseUser.uid ? ' (you)' : ''}
                </span>
                <span className={`space-role-badge ${m.role}`}>{m.role}</span>
                {activeRoom?.isAdmin && m.uid !== firebaseUser.uid && (
                  <div className="space-member-actions">
                    {m.role !== 'admin' && (
                      <button type="button" className="space-mini-btn" onClick={() => handlePromoteMember(m.uid)}>
                        Make admin
                      </button>
                    )}
                    <button type="button" className="space-mini-btn danger" onClick={() => handleKickMember(m.uid)}>
                      Kick
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div className="space-modal-actions">
              <button type="button" className="collab-btn" onClick={() => setShowMembersModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}