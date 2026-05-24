import React, { useEffect, useState } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseAuth/firebase';
import './home.css';

//typescript of homepage
export const Home: React.FC = () => {
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

    //html of homepage
    return (
        <div className="home">
            <aside className="sidebar">
                <div className="logo">
                    <h1>Capingo</h1>
                </div>
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

                <div className="main-content">
                    {activeTab === 'dashboard' && <div className="welcome-card">This is your dashboard!</div>}
                    {activeTab === 'timetable' && <div className="placeholder-view">Timetable here!</div>}
                    {activeTab === 'flashcards' && <div className="placeholder-view">Flashcards here!</div>}
                    {activeTab === 'chatbot' && <div className="placeholder-view">Capybara Chatbot here!</div>}
                </div>
            </main>
        </div>
    );
};