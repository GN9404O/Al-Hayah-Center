import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GraduationCap, 
  Users, 
  Calendar, 
  UserSquare2, 
  Users2, 
  Settings,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../ui';

const navItems = [
  { icon: LayoutDashboard, label: 'نظرة عامة', path: '/' },
  { icon: GraduationCap, label: 'المراحل الدراسية', path: '/grades' },
  { icon: Calendar, label: 'الجداول', path: '/schedules' },
  { icon: UserSquare2, label: 'المعلمون', path: '/teachers' },
  { icon: Users2, label: 'الطلاب', path: '/students' },
  { icon: Settings, label: 'الإعدادات', path: '/settings' },
];

export function Sidebar() {
  const { logout } = useAuth();
  const { settings } = useSettings();

  return (
    <aside className="w-64 bg-white border-l border-gray-200 flex flex-col h-screen fixed right-0 top-0 z-40 lg:static">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-gray-900 truncate">{settings?.systemName || 'إديو سنتر'}</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
              isActive 
                ? 'bg-blue-50 text-blue-600 font-bold' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <item.icon className={cn('w-5 h-5 transition-transform group-hover:scale-110')} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
