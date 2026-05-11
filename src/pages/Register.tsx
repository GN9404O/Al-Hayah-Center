import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Grade } from '../types';
import { ACADEMIC_STAGES } from '../constants';

export function Register() {
  const { user, login, loading } = useAuth();
  const { settings } = useSettings();
  const [grades, setGrades] = useState<Grade[]>([]);

  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grades'), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });
    return unsub;
  }, []);

  const handleRegisterWithGoogle = () => {
    if (!selectedGradeId) {
      alert('الرجاء اختيار الصف الدراسي أولاً');
      return;
    }
    // Save selection to localStorage for AuthContext to pick up
    localStorage.setItem('pending_grade_id', selectedGradeId);
    login().catch(() => {
      localStorage.removeItem('pending_grade_id');
    });
  };

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
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 -mt-24 relative z-20 pb-16">
        <div className="flex justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white shadow-2xl rounded-3xl p-8 md:p-10 w-full max-w-[480px] border border-white"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">إنشاء حساب جديد</h2>
              <p className="text-gray-500 text-sm">انضم إلينا وابدأ رحلتك اليوم - اختر مرحلتك الدراسية وسجل دخولك</p>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-600 mb-2 px-1">المرحلة الدراسية</label>
                <select 
                  className="w-full bg-gray-50 border-none focus:ring-2 focus:ring-blue-600 focus:bg-white rounded-xl p-4 text-right transition-all font-bold mb-4"
                  value={selectedStageId}
                  onChange={(e) => {
                    setSelectedStageId(e.target.value);
                    setSelectedGradeId('');
                  }}
                >
                  <option value="">اختر المرحلة الدراسية</option>
                  {ACADEMIC_STAGES.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                  {grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).length > 0 && (
                    <optgroup label="مراحل أخرى">
                      {grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).map(grade => (
                        <option key={grade.id} value={grade.id}>{grade.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {selectedStageId && ACADEMIC_STAGES.find(s => s.id === selectedStageId) && (
                  <>
                    <label className="text-xs font-bold text-gray-600 mb-2 px-1">الصف الدراسي</label>
                    <select 
                      className="w-full bg-gray-50 border-none focus:ring-2 focus:ring-blue-600 focus:bg-white rounded-xl p-4 text-right transition-all font-bold"
                      value={selectedGradeId}
                      onChange={(e) => setSelectedGradeId(e.target.value)}
                    >
                      <option value="">اختر صفك الدراسي</option>
                      {ACADEMIC_STAGES.find(s => s.id === selectedStageId)?.grades.map(grade => (
                        <option key={grade.id} value={grade.id}>{grade.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-gray-300 text-xs font-medium">سجل للمتابعة</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

              <button 
                onClick={handleRegisterWithGoogle}
                disabled={loading || !selectedGradeId}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 py-4 rounded-2xl hover:bg-gray-50 hover:border-blue-200 transition-all text-sm font-bold text-gray-700 shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                type="button"
              >
                <img alt="Google Logo" className="w-5 h-5" src="https://www.google.com/favicon.ico" />
                <span>التسجيل بواسطة جوجل</span>
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm">لديك حساب بالفعل؟ <Link to="/login" className="text-blue-600 font-black hover:underline">تسجيل الدخول</Link></p>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="w-full py-8 px-6 flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto border-t border-gray-100 text-gray-400">
        <div className="text-xs font-medium mb-4 md:mb-0">
          © {settings?.systemName || 'EduCenter'} {new Date().getFullYear()}. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}
