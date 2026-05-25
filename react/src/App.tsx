import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebaseAuth/firebase';
import { Login } from './loginAuth/login';
import { Home } from './homepage/home';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  {/*loading screen*/}
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#fffcf4',
        color: '#8b7355',
        fontFamily: 'sans-serif',
        fontSize: '1.2rem'
      }}>
        Loading Capingo...
      </div>
    );
  }

  {/*login or not*/}
  return (
    <>
      {user ? <Home /> : <Login />}
    </>
  );
}

export default App;