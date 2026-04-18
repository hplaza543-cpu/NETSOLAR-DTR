import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      
      // If admin login, append dummy domain to username
      const finalEmail = isAdminLogin && !email.includes('@') ? `${email}@admin.netsolar.local` : email;
      
      try {
        const result = await signInWithEmailAndPassword(auth, finalEmail, password);
        
        // Ensure superadmin doc exists
        if (isAdminLogin && email === 'superadmin') {
           const docRef = doc(db, 'users', result.user.uid);
           const docSnap = await getDoc(docRef);
           if (!docSnap.exists()) {
              await setDoc(docRef, {
                uid: result.user.uid,
                name: 'Super Admin',
                email: finalEmail,
                role: 'admin',
                department: 'System',
                createdAt: new Date().toISOString()
              });
           }
        }
        
        await checkProfileAndNavigate(result.user.uid);
      } catch (signInErr: any) {
        // Automatically bootstrap the superadmin if it doesn't exist
        if (isAdminLogin && email === 'superadmin' && password === 'angsarapmoharold143') {
           try {
             const result = await createUserWithEmailAndPassword(auth, finalEmail, password);
             await setDoc(doc(db, 'users', result.user.uid), {
               uid: result.user.uid,
               name: 'Super Admin',
               email: finalEmail,
               role: 'admin',
               department: 'System',
               createdAt: new Date().toISOString()
             });
             await checkProfileAndNavigate(result.user.uid);
             return;
           } catch (createErr: any) {
             if (createErr.code === 'auth/email-already-in-use') {
               throw new Error('Invalid credentials.');
             }
             throw createErr;
           }
        }
        throw signInErr;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const docRef = doc(db, 'users', result.user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        await auth.signOut();
        setError('No account yet? register first.');
      } else {
        const profile = docSnap.data();
        if (profile.role === 'admin' || profile.role === 'accounting') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to log in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkProfileAndNavigate = async (uid: string) => {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      await auth.signOut();
      setError('No account yet? register first.');
    } else {
      const profile = docSnap.data();
      if (profile.role === 'admin' || profile.role === 'accounting') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-amber-500 rounded-full flex items-center justify-center mb-4 text-white">
            <span className="font-bold text-2xl">N</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">NETSOLAR</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Daily Time Record System</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="mt-8 space-y-6">
          {/* Admin Login Toggle */}
          <div className="flex justify-center mb-4">
            <button
              type="button"
              onClick={() => {
                setIsAdminLogin(!isAdminLogin);
                setEmail('');
                setPassword('');
                setError('');
              }}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                isAdminLogin ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {isAdminLogin ? 'Switch to Employee Login' : 'Admin Login (Username)'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {isAdminLogin ? 'Admin Username' : 'Email'}
              </label>
              <input
                type={isAdminLogin ? 'text' : 'email'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAdminLogin ? 'e.g. superadmin' : 'name@example.com'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50 text-[15px]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 rounded-xl bg-white dark:bg-gray-700 text-[15px] font-semibold text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
          </div>
        </div>
        
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
