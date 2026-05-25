import React, { useEffect, useState } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseAuth/firebase';
import './home.css';

export const Home: React.FC = () => {
    {/*typescript part*/}
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<string>('dashboard');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            }
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

    {/*html part*/}
    return (
        <div className="home">
            <aside className="sidebar">
                <div className="logo">
                    <h1>Capingo</h1>
                </div>
                 {/*active tab for temporary use*/}
                <nav className="menu"> 
                    <button
                    className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                        Dashboard
                    </button>
                    <button 
                    className={`menu-item ${activeTab === 'timetable' ? 'active' : ''}`} onClick={() => setActiveTab('timetable')}>
                        Timetable
                    </button>
                    <button 
                    className={`menu-item ${activeTab === 'flashcards' ? 'active' : ''}`} onClick={() => setActiveTab('flashcards')}>
                        Flashcards
                    </button>
                    <button
                    className={`menu-item ${activeTab === 'chatbot' ? 'active' : ''}`} onClick={() => setActiveTab('chatbot')}>
                        Capybara Chatbot
                    </button>
                    <button
                    className={`menu-item ${activeTab === 'collaboration' ? 'active' : ''}`} onClick={() => setActiveTab('collaboration')}>
                        Collaboration Space
                    </button>
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

                {/*active tab for temporary use*/}
                <div className="main-content">
                    {activeTab === 'dashboard' && <div className="placeholder">This is your dashboard!</div>}
                    {activeTab === 'timetable' && <div className="placeholder">Timetable here!</div>}
                    {activeTab === 'flashcards' && <div className="placeholder">Flashcards here!</div>}
                    {activeTab === 'chatbot' && <div className="placeholder">Capybara Chatbot here!</div>}
                    {activeTab === 'collaboration' && <div className="placeholder">Collaboration Space here!</div>}
                </div>
            </main>
        </div>
    );
};