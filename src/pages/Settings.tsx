import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Camera, Image as ImageIcon, User, Briefcase, Key, X } from 'lucide-react';
import Layout from '../components/Layout';

const DEPARTMENTS = ['Project Management Engineer', 'HR', 'Marketing', 'Accounting', 'Sales', 'Operations', 'SPT', 'O&M', 'HOME', 'Other'];

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [department, setDepartment] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [phone, setPhone] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'work' | 'account'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [showCamera, setShowCamera] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (profile) {
      setDepartment(profile.department || '');
      setPhotoURL(profile.photoURL || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);
  
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setMessage({ text: 'Unable to access camera. Please ensure permissions are granted.', type: 'error' });
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 256;
      const MAX_HEIGHT = 256;
      
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      
      let width = videoWidth;
      let height = videoHeight;
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // Crop to center if we want to make it look square/nice, or just draw stretched/scaled
      // We'll just draw the scaled video frame
      ctx?.drawImage(videoRef.current, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhotoURL(dataUrl);
      stopCamera();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Please select a valid image file.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoURL(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        department,
        photoURL,
        phone
      });
      await refreshProfile();
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setMessage({ text: 'Failed to update profile.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Settings">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 space-y-1">
          <button
            onClick={() => { setActiveTab('profile'); setMessage({text: '', type: ''}); }}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              activeTab === 'profile' 
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <User className="w-5 h-5 mr-3" />
            Profile Details
          </button>
          <button
            onClick={() => { setActiveTab('work'); setMessage({text: '', type: ''}); }}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              activeTab === 'work' 
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Briefcase className="w-5 h-5 mr-3" />
            Work Information
          </button>
          <button
            onClick={() => { setActiveTab('account'); setMessage({text: '', type: ''}); }}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              activeTab === 'account' 
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Key className="w-5 h-5 mr-3" />
            Account Security
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
          {message.text && (
            <div className={`p-4 mb-6 rounded-lg text-sm flex items-center ${
              message.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
            }`}>
              {message.text}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Profile Details</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage your personal information and how you appear to others.</p>
              </div>

              {/* Profile Image Section */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-5 border-b border-gray-100 dark:border-gray-700">
                <img 
                  src={photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.name}`} 
                  alt="Avatar Preview" 
                  className="w-20 h-20 rounded-full object-cover bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600"
                />
                <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                      >
                        <ImageIcon className="w-4 h-4 mr-1.5" />
                        Browse
                      </button>
                      
                      <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                      >
                        <Camera className="w-4 h-4 mr-1.5 text-amber-500" />
                        Take Photo
                      </button>

                      {photoURL && profile?.photoURL !== photoURL && (
                        <button
                          type="button"
                          onClick={() => setPhotoURL(profile?.photoURL || '')}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">JPG, GIF or PNG. Max 2MB. Resized automatically.</p>
                  </div>
                </div>

                {showCamera && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
                      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Take Photo</h3>
                        <button onClick={stopCamera} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-4 flex flex-col items-center bg-gray-50 dark:bg-gray-900">
                        <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                          <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" playsInline autoPlay muted />
                          
                          {/* Face outline guide */}
                          <div className="absolute inset-0 border-2 border-white/30 rounded-full m-8 pointer-events-none"></div>
                        </div>
                      </div>
                      <div className="p-4 flex justify-between bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={stopCamera}
                          className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={capturePhoto}
                          className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Capture
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Personal Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Display Name</label>
                  <input
                    type="text"
                    disabled
                    value={profile?.name || ''}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white opacity-70 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-400">Name changes require admin approval.</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Username</label>
                    <input
                      type="text"
                      disabled
                      value={profile?.username ? `@${profile.username}` : ''}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white opacity-70 cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +63 912 345 6789"
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-900 dark:text-white shadow-sm transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold rounded-xl shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50 text-sm"
                >
                  {loading ? 'Saving Changes...' : 'Save Profile Details'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'work' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Work Information</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Your role, department and internal employment details.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-2">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={profile?.role !== 'admin'}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 disabled:dark:bg-gray-900 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {profile?.role !== 'admin' && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-500 font-medium">To change your department, please contact your administrator.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">System Role</label>
                  <input
                    type="text"
                    disabled
                    value={profile?.role.toUpperCase() || ''}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-semibold opacity-70 cursor-not-allowed uppercase"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={loading || profile?.role !== 'admin'}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold rounded-xl shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50 text-sm"
                >
                  {loading ? 'Saving...' : 'Save Work Info'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Account Security</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage your credentials and login safety.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white opacity-70 cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-500 font-medium">Your email is tied to the central identity provider and cannot be changed here.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
