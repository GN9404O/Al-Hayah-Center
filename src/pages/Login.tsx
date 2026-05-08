import React from 'react';
import { GraduationCap, ShieldCheck, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { motion } from 'motion/react';

export function Login() {
  const { user, login, loading } = useAuth();
  const { settings } = useSettings();

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-blue-600 font-bold animate-pulse text-sm">جاري مراجعة البيانات...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f7f9ff] text-[#151c24] font-sans overflow-x-hidden" dir="rtl">
      {/* Signature Header */}
      <header 
        className="w-full h-[40vh] flex flex-col items-center justify-center relative overflow-hidden bg-[#005bbf]"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 91, 191, 0.9), rgba(0, 91, 191, 0.95)), url('https://lh3.googleusercontent.com/aida-public/AB6AXuBhtJw_rUa0cJyY12aiEsWSyr6dPekZG-m7msmeSTprgEi_CJRp-_yCa6AFtD9YJA_VAHkQLUQgAgNt-4BLEH15JRN_6RxQsWCjV26Z5t3eCBqzuKfFYyZ3D-Yv1F7nkE7NNjUFvuGx3ySOuFKqXwheko1oOtFeFemz9P847pLyYK829FLJ7luXVosvjRPpE1eKU-7-JwFBcejJdqQJHlIq6ubQy8RGpwTUVV7KPM0pWinhPz3WALHv0n42GLO58gpkEWtp4vzJkq8')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 text-center px-4"
        >
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2">{settings?.systemName || 'إديو سنتر'}</h1>
          <p className="text-lg md:text-xl text-white/90 font-medium tracking-wide">{settings?.systemDescription || 'منصة التعلم المتكاملة'}</p>
        </motion.div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-blue-300/30 blur-3xl"></div>
          <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-indigo-300/20 blur-3xl"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 -mt-24 relative z-20 pb-16">
        <div className="flex justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="bg-white shadow-2xl rounded-3xl p-8 md:p-10 w-full max-w-[480px] border border-white"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">مرحباً بك مجدداً</h2>
              <p className="text-gray-500 text-sm">سجل دخولك للمتابعة إلى حسابك التعليمي</p>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {/* Email Field */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-600 mb-2 px-1" htmlFor="email">البريد الإلكتروني</label>
                <input 
                  className="w-full bg-gray-50 border-none focus:ring-2 focus:ring-blue-600 focus:bg-white rounded-xl p-4 text-right transition-all placeholder:text-gray-300 text-gray-900"
                  id="email" 
                  placeholder="example@educenter.com" 
                  type="email"
                />
              </div>

              {/* Password Field */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-600 mb-2 px-1" htmlFor="password">كلمة المرور</label>
                <input 
                  className="w-full bg-gray-50 border-none focus:ring-2 focus:ring-blue-600 focus:bg-white rounded-xl p-4 text-right transition-all placeholder:text-gray-300"
                  id="password" 
                  placeholder="••••••••" 
                  type="password"
                />
              </div>

              <div className="flex justify-between items-center px-1">
                <a className="text-blue-600 text-xs font-bold hover:underline" href="#">نسيت كلمة المرور؟</a>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 font-medium" htmlFor="remember">تذكرني</label>
                  <input className="rounded border-gray-300 text-blue-600 focus:ring-blue-600" id="remember" type="checkbox" />
                </div>
              </div>

              {/* Disabled/Visual Sign In button */}
              <button 
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98] cursor-not-allowed opacity-50"
                type="button"
                disabled
              >
                تسجيل الدخول
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-gray-300 text-xs font-medium">أو</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

              {/* Google Login button */}
              <button 
                onClick={() => {
                  login().catch(() => {}); // Catch handled in context
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border-2 border-gray-50 py-4 rounded-2xl hover:bg-gray-50 hover:border-gray-100 transition-all text-sm font-bold text-gray-700 shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                type="button"
              >
                <img alt="Google Logo" className="w-5 h-5" src="https://www.google.com/favicon.ico" />
                <span>الدخول بواسطة جوجل</span>
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm">ليس لديك حساب؟ <Link to="/register" className="text-blue-600 font-black hover:underline">أنشئ حساباً جديداً</Link></p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 px-6 flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto border-t border-gray-100 text-gray-400">
        <div className="text-xs font-medium mb-4 md:mb-0">
          © {settings?.systemName || 'EduCenter'} {new Date().getFullYear()}. جميع الحقوق محفوظة.
        </div>
        <div className="flex gap-6">
          <a className="text-xs font-medium hover:text-blue-600 transition-colors" href="#">عن المنصة</a>
          <a className="text-xs font-medium hover:text-blue-600 transition-colors" href="#">الدعم الفني</a>
          <a className="text-xs font-medium hover:text-blue-600 transition-colors" href="#">سياسة الخصوصية</a>
        </div>
      </footer>
    </div>
  );
}
