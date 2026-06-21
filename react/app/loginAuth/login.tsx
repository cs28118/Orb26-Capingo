import React, { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
        GoogleAuthProvider, signInWithPopup,
        onAuthStateChanged
        } from 'firebase/auth';
import { auth } from '../firebaseAuth/firebase';
import { useNavigate } from "react-router";
import './login.css';

//typescript of login page
export default function Login() {
    const [name, setName] = useState<string>(''); //user name
    const [email, setEmail] = useState<string>(''); //user email
    const [password, setPassword] = useState<string>(''); //user password
    const [isRegistering, setIsRegistering] = useState<boolean>(false); //user is registering or signing in
    const [error, setError] = useState<string>(''); //error message appear
    const [loading, setLoading] = useState<boolean>(false); //loading state
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
        if (isRegistering) { //if in registering state create account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            if (userCredential.user) {
            await updateProfile(userCredential.user, { displayName: name });
            }
            console.log("Account created successfully for:", name);
        } else { //if not in registering state sign in
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Logged in successfully!");
            navigate("/home");
        }
        } catch (err: any) {
            switch (err.code) {
                case 'auth/invalid-credential': //invalid email or password
                    setError('Incorrect email or password. Please try again.');
                    break;
                case 'auth/email-already-in-use': //repeated email
                    setError('This email is already registered to an account.');
                    break;
                case 'auth/weak-password': //password weak
                    setError('Password must be at least 6 characters long.');
                    break;
                default: //other errors
                    setError('An unexpected authentication error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            console.log("Google Login Successful! User:", result.user.displayName);
            navigate("/home");
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user') {
                setError('Failed to log in. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                console.log("Logged in! Redirecting...");
                navigate("/home", { replace: true });
            }
        });
        return () => unsubscribe();
    }, [navigate]);


    //html of login page
    return (
        <div className="login-page">
            <div className="login-box">
                <div className="mascot-container">
                    <img src="/capingo-logo.png" alt="Capingo" className="login-logo" />
                </div>
                <h2>{isRegistering ? 'Join Capingo now!' : 'Welcome to Capingo!'}</h2>
                {error && <div className="error-message" style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    {isRegistering && ( //need name while registering
                        <div className="form-content">
                        <label>Your Name:</label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="What should we call you?"
                            required={isRegistering}
                        />
                        </div>
                    )}

                    <div className="form-content">
                        <label>Email adress:</label>
                        <input type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="capingo@example.com"
                            required/>
                    </div>

                    <div className="form-content">
                        <label>Password:</label>
                        <input type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required />
                    </div>

                    <button className="btn-submit" type="submit" disabled={loading}>
                        {loading ? 'Connecting...' : isRegistering ? 'Create Account' : 'Enter Capingo!'}
                    </button>
                </form>

                <div className="google-divider">or</div>
                    <button className="google-btn" onClick={handleGoogleSignIn} disabled={loading}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" />
                        {isRegistering ? 'Sign up with Google' : 'Continue with Google'}
                    </button>
                
                <div className="register-signin" style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                    {isRegistering ? (<>
                        Already have an account?{' '}
                        <span 
                            onClick={() => { setIsRegistering(false); setError(''); }} 
                            style={{ color: 'brown', cursor: 'pointer', textDecoration: 'underline' }}>
                            Sign In
                        </span>
                    </>) : (<>
                        New to Capingo?{' '}
                        <span 
                            onClick={() => { setIsRegistering(true); setError(''); }} 
                            style={{ color: 'brown', cursor: 'pointer', textDecoration: 'underline' }}>
                            Create an account
                        </span>
                    </>)}
                </div>
            </div>
        </div>
    );
};