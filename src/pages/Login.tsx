import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { motion } from 'motion/react';

export default function Login() {
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      
      let inputVal = usernameInput.trim();
      if (!inputVal) {
        throw new Error('Please enter your username.');
      }

      if (inputVal.includes('@')) {
        throw new Error('Please log in using your username instead of your email address.');
      }

      const isSuperAdmin = inputVal.toLowerCase() === 'superadmin';
      let finalEmail = inputVal;
      
      if (isSuperAdmin) {
        finalEmail = 'superadmin@admin.netsolar.local';
      } else {
        // Look up the email associated with this username
        const usernameDoc = await getDoc(doc(db, 'usernames', inputVal.toLowerCase()));
        if (usernameDoc.exists()) {
          finalEmail = usernameDoc.data().email;
        } else {
          throw new Error('Invalid username or password.');
        }
      }
      
      try {
        const result = await signInWithEmailAndPassword(auth, finalEmail, password);
        
        // Ensure superadmin doc exists
        if (isSuperAdmin) {
           const docRef = doc(db, 'users', result.user.uid);
           const docSnap = await getDocFromServer(docRef);
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
        if (isSuperAdmin && password === 'angsarapmoharold143') {
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
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("Invalid password. If you originally created this account using Google, please use the 'Log in with Google' button below instead.");
      } else {
        setError(err.message || 'Failed to log in');
      }
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
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDocFromServer(docRef);
      
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
    } catch (e: any) {
      if (e.message.includes('offline') || e.message.includes('permissions')) {
        // Fallback to cache if server is unreachable or permissions explicitly blocking getDocFromServer before propagation
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
           const profile = docSnap.data();
           if (profile.role === 'admin' || profile.role === 'accounting') {
             navigate('/admin');
           } else {
             navigate('/');
           }
        } else {
           await auth.signOut();
           setError('No account yet? register first.');
        }
      } else {
        throw e;
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-900 relative">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700 transition-all hover:scale-105 active:scale-95"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Left Panel - Image Cover */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gray-900">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1509391366360-12006cb75b23?q=80&w=2670&auto=format&fit=crop" 
          alt="Solar Panels" 
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-12 lg:p-20">
          <div>
            <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <span className="font-extrabold text-3xl">N</span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-6 tracking-tight">NETSOLAR</h2>
          </div>
          <div className="text-white max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Empowering the future of <span className="text-amber-400">renewable energy.</span>
            </h1>
            <p className="text-lg text-gray-300 font-medium">
              Streamline your workflow with our advanced Daily Time Record System. Built specifically for the modern solar workforce.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 bg-gray-50 dark:bg-gray-900 overflow-y-auto"
      >
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 dark:border-gray-700/50">
          <div className="text-center lg:text-left">
            <div className="lg:hidden mx-auto h-12 w-12 bg-amber-500 rounded-xl flex items-center justify-center mb-6 text-white shadow-lg shadow-amber-500/20">
              <span className="font-bold text-2xl">N</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">Sign in to your NETSOLAR account</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-4 rounded-xl text-sm text-center font-medium">
              {error}
            </div>
          )}

        <form onSubmit={handleEmailLogin} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. jdoe_99"
                autoComplete="username"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white lowercase transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:shadow-[0_4px_20px_-4px_rgba(245,158,11,0.15)] focus:-translate-y-0.5"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white pr-10 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:shadow-[0_4px_20px_-4px_rgba(245,158,11,0.15)] focus:-translate-y-0.5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 text-[15px]"
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
              className="w-full flex justify-center items-center py-3 px-4 border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 rounded-xl bg-white dark:bg-gray-700 text-[15px] font-semibold text-gray-700 dark:text-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
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
        
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6 pb-2">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
            Register here
          </Link>
        </div>
      </div>
     </motion.div>
    </div>
  );
}
