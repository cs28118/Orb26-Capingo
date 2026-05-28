import { useEffect, useState } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseAuth/firebase';
import { Outlet, NavLink, Navigate } from 'react-router';
import './home.css';

export default function Home() {
    {/* ts part */}
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

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

    if (!user) {
        return <Navigate to="/" replace />;
    }

    {/* html part */}
    return (
        <div className="home">
            <aside className="sidebar">
                <div className="logo">
                    <h1>Capingo</h1>
                </div>

                <nav className="menu">
                    <NavLink to="/home" end className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Dashboard
                    </NavLink>
                    
                    <NavLink to="/home/timetable" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Timetable
                    </NavLink>
                    
                    <NavLink to="/home/flashcard" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Flashcards
                    </NavLink>
                    
                    <NavLink to="/home/chatbot" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Capybara Chatbot
                    </NavLink>
                    
                    <NavLink to="/home/collaboration" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        Collaboration Space
                    </NavLink>
                </nav>

                <button className="btn-logout" onClick={handleLogout}> 
                    Log Out
                </button>
            </aside>

            <main className="main">
                <header className="main-header">
                    <h1>Welcome back, {user?.displayName || 'Capy Friend'}!</h1>
                    <p>Ready to study?</p>
                </header>

                <div className="main-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}