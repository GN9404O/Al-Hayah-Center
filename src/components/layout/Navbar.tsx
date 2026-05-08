import React from 'react';
import { Bell, Search, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1">
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-900">{user?.displayName}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role === 'admin' ? 'مدير النظام' : 'موظف'}</p>
          </div>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border border-gray-200 shadow-sm" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
