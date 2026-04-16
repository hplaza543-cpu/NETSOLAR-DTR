import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';
import Announcements from './pages/Announcements';
import LeaveRequests from './pages/LeaveRequests';
import Timesheets from './pages/Timesheets';
import Adjustments from './pages/Adjustments';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { profile, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            {(profile?.role === 'admin' || profile?.role === 'accounting') ? <Navigate to="/admin" /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'accounting']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/announcements" 
        element={
          <ProtectedRoute>
            <Announcements />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/leave-requests" 
        element={
          <ProtectedRoute>
            <LeaveRequests />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/adjustments" 
        element={
          <ProtectedRoute>
            <Adjustments />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/timesheets" 
        element={
          <ProtectedRoute allowedRoles={['employee', 'intern']}>
            <Timesheets />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
