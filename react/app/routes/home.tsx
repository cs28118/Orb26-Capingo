import { useEffect, useState } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseAuth/firebase';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router';
import './home.css';
import ToastContainer from '../components/Noti';
import type { userData } from '../types/types';

export default function Home() {
    const [userData, setUserData] = useState<userData | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const location = useLocation();
    const isChatbot = location.pathname.includes('/chatbot');
    const isFlashcard = location.pathname.includes('/flashcard');
    const isFullBleed = isChatbot || isFlashcard;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setFirebaseUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

      useEffect(() => {
    if (!firebaseUser) return;
    const fetchUserData = async () => {
      try {
        const queryParams = new URLSearchParams({
          username: firebaseUser.displayName || 'Student',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || ''
        });
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/${firebaseUser.uid}?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch user data');
        const data = await response.json();
        setUserData(data);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [firebaseUser]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            console.log("Logged out successfully!");
        } catch (err) {
            console.error("Error signing out:", err);
        }
    };

    if (loading) {
        return (
            <div className="loading-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <h2>Loading Capingo...</h2>
            </div>
        );
    }

    if (!firebaseUser) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="home">
            <header className="sidebar">
                <div className="logo">
                    <img src="/capingo-logo.png" alt="" className="logo-mascot" />
                    <h1>Capingo</h1>
                </div>

                <nav className="menu">
                    <NavLink to="/home" end className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Dashboard
                    </NavLink>
                    
                    <NavLink to="/home/timetable" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Timetable
                    </NavLink>
                    
                    <NavLink to="/home/chatbot" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Chatbot
                    </NavLink>
                    
                    <NavLink to="/home/flashcard" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Flashcard
                    </NavLink>
                    
                    <NavLink to="/home/collaboration" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Study Partners
                    </NavLink>
                </nav>

                <div className="user-profile-logout">
                    <span className="user-welcome">Hi, {userData?.username || firebaseUser?.displayName}!</span>
                    <button type="button" className="btn-logout" onClick={handleLogout}> 
                        Log Out
                    </button>
                </div>
            </header>

            <main className={`main-content ${isFullBleed ? 'main-content--chatbot' : ''}`}>
                <div className={`inner-view ${isFullBleed ? 'inner-view--chatbot' : ''}`}>
                    <Outlet />
                </div>
            </main>

            <ToastContainer />
        </div>
    );
}
