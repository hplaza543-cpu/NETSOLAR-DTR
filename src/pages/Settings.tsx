import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';

const DEPARTMENTS = ['Project Engineer', 'HR', 'Marketing', 'Accounting', 'Sales', 'Operations', 'SPT', 'O&M', 'HOME', 'Other'];

export default function Settings() {
  const { user, profile } = useAuth();
  const [department, setDepartment] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDepartment(profile.department || '');
      setPhotoURL(profile.photoURL || '');
    }
  }, [profile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file.');
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
    setMessage('');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        department,
        photoURL
      });
      setMessage('Profile updated successfully! Refresh to see changes.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setMessage('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Settings">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h2>
        
        {message && (
          <div className={`p-4 mb-6 rounded-lg text-sm ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
            <div className="flex items-center space-x-4">
              <img 
                src={photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.name}`} 
                alt="Avatar Preview" 
                className="w-16 h-16 rounded-full object-cover bg-gray-100 border border-gray-200"
              />
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                >
                  Upload Image
                </button>
                {photoURL && profile?.photoURL !== photoURL && (
                  <button
                    type="button"
                    onClick={() => setPhotoURL(profile?.photoURL || '')}
                    className="ml-3 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Upload an image (max 256x256). It will be resized automatically.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
