import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function ForgotPassword() {
  const [inputVal, setInputVal] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      setError('Please enter your email or username');
      return;
    }

    try {
      setMessage('');
      setError('');
      setLoading(true);

      let emailToSend = inputVal.trim();
      const isEmail = emailToSend.includes('@');

      if (!isEmail) {
        // Look up email by username
        const usernameDoc = await getDoc(doc(db, 'usernames', inputVal.trim().toLowerCase()));
        if (usernameDoc.exists()) {
          emailToSend = usernameDoc.data().email;
        } else {
          throw new Error('Username not found. Please double check and try again.');
        }
      }

      await sendPasswordResetEmail(auth, emailToSend);
      setMessage('Password reset email sent! Check your inbox and spam folder.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with that email address.');
      } else {
        setError(err.message || 'Failed to reset password.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 relative">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700 transition-all hover:scale-105 active:scale-95"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check your email</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            {message}
          </p>
          <Link
            to="/login"
            className="w-full flex justify-center py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all active:scale-[0.98]"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

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
          src="https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?q=80&w=2574&auto=format&fit=crop" 
          alt="Professional Environment" 
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
              Regain access to your <span className="text-amber-400">workspace.</span>
            </h1>
            <p className="text-lg text-gray-300 font-medium">
              We'll help you get back on track securely and easily.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 dark:border-gray-700/50">
          <div className="text-center lg:text-left">
            <div className="lg:hidden mx-auto h-12 w-12 bg-amber-500 rounded-xl flex items-center justify-center mb-6 text-white shadow-lg shadow-amber-500/20">
              <span className="font-bold text-2xl">N</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Reset Password</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">Enter your username or email to receive a reset link</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-4 rounded-xl text-sm flex items-start font-medium">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleReset} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username or Email</label>
              <input
                type="text"
                required
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value.toLowerCase())}
                placeholder="e.g. jdoe_99 or name@example.com"
                autoComplete="username"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white lowercase transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:shadow-[0_4px_20px_-4px_rgba(245,158,11,0.15)] focus:-translate-y-0.5"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 text-[15px]"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-8 text-center lg:text-left pb-2">
            <Link
              to="/login"
              className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
