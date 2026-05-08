import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Grades } from './pages/Grades';
import { Schedules } from './pages/Schedules';
import { Teachers } from './pages/Teachers';
import { Students } from './pages/Students';
import { Settings } from './pages/Settings';
import { Toaster } from 'react-hot-toast';

import { StudentPortal } from './pages/StudentPortal';

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Main Route Handler */}
            <Route path="/" element={<RoleBasedRoute />} />

            {/* Admin Routes */}
            <Route element={<AdminRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/grades" element={<Grades />} />
                <Route path="/schedules" element={<Schedules />} />
                <Route path="/teachers" element={<Teachers />} />
                <Route path="/students" element={<Students />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </SettingsProvider>
  );
}

function RoleBasedRoute() {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin text-blue-600">...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role === 'admin') return (
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>
  );
  return <StudentPortal />;
}

function AdminRoute({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  
  return <>{children || <Outlet />}</>;
}

import { Outlet, Navigate } from 'react-router-dom';
