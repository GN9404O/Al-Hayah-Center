import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Grade, Schedule, Group, Teacher } from '../types';
import { ACADEMIC_STAGES } from '../constants';
import { LogOut, Search, Clock, MapPin, Send, MessageSquare, AlertCircle, Facebook, Instagram, Twitter, Youtube, Phone, Info, Star, ShieldCheck, Mail, Share2, X, ChevronDown, Filter, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../components/ui';

import { updateProfile } from 'firebase/auth';

export function StudentPortal() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDataInitialized, setIsDataInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'subjects' | 'exams' | 'account'>('home');
  const [selectedTeacherProfile, setSelectedTeacherProfile] = useState<Teacher | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('edu_center_grade_id');
    localStorage.removeItem('edu_center_stage_id');
    logout();
  };



  // Fetch student profile
  useEffect(() => {
    if (!user) {
      setIsProfileLoaded(true);
      return;
    }
    const unsub = onSnapshot(doc(db, 'students', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudentProfile({ id: docSnap.id, ...data });
        // Auto-select grade from profile if available
        if (data.gradeId && !selectedGradeId) {
          setSelectedGradeId(data.gradeId);
        }
      } else {
        setStudentProfile(null);
      }
      setIsProfileLoaded(true);
    });
    return unsub;
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    // Using simple collection fetch to ensure responsiveness, ordering in JS if needed
    const unsubGrades = onSnapshot(collection(db, 'grades'), (snapshot) => {
      const gradesData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Grade))
        .sort((a, b) => a.name.localeCompare(b.name));
      setGrades(gradesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching grades:", error);
      setLoading(false);
    });

    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    }, (error) => {
      console.error("Error fetching teachers:", error);
    });

    return () => {
      unsubGrades();
      unsubTeachers();
    };
  }, []);

  // Fetch contextual data when grade is selected
  useEffect(() => {
    // Only proceed if grade is set AND profile is fully resolved (to avoid auth/profile race)
    if (!selectedGradeId || !isProfileLoaded) {
      if (!selectedGradeId) {
        setSchedules([]);
        setGroups([]);
        setIsDataInitialized(true);
      }
      return;
    }

    setIsDataInitialized(false);

    const unsubSchedules = onSnapshot(
      query(collection(db, 'schedules'), where('gradeId', '==', selectedGradeId)),
      (snapshot) => {
        setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
        setIsDataInitialized(true);
      },
      (error) => {
        console.error("Error fetching schedules:", error);
        setIsDataInitialized(true);
      }
    );

    const unsubGroups = onSnapshot(
      query(collection(db, 'groups'), where('gradeId', '==', selectedGradeId)),
      (snapshot) => {
        const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        setGroups(groupsData);
        if (groupsData.length > 0 && !selectedSubject) {
          setSelectedSubject(groupsData[0].subject);
        }
      },
      (error) => {
        console.error("Error fetching groups:", error);
      }
    );

    return () => {
      unsubSchedules();
      unsubGroups();
    };
  }, [selectedGradeId, isProfileLoaded]);

  const subjects = useMemo(() => {
    // Get subjects from all teachers
    const teacherSubjects = teachers.map(t => t.subject);
    
    // Also include subjects from groups
    const groupSubjects = groups.map(g => g.subject);
    
    const allSubjects = new Set([...teacherSubjects, ...groupSubjects]);
    return Array.from(allSubjects).filter(Boolean);
  }, [teachers, groups]);

  const filteredTeachers = useMemo(() => {
    let filtered = [...teachers];
    
    if (selectedSubject) {
      filtered = filtered.filter(t => t.subject === selectedSubject);
    }
    
    return filtered;
  }, [selectedSubject, teachers]);

  const getCurrentDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const formatTime12h = (time: string) => {
    if (!time) return '';
    try {
      const [hours, minutes] = time.split(':');
      let h = parseInt(hours);
      const m = minutes || '00';
      const period = h >= 12 ? 'م' : 'ص';
      h = h % 12 || 12;
      return `${h}:${m} ${period}`;
    } catch {
      return time;
    }
  };

  const getDayArabic = (day: string) => {
    const labels: Record<string, string> = {
      'Saturday': 'السبت', 'Sunday': 'الأحد', 'Monday': 'الاثنين', 'Tuesday': 'الثلاثاء', 
      'Wednesday': 'الأربعاء', 'Thursday': 'الخميس', 'Friday': 'الجمعة'
    };
    return labels[day] || day;
  };

  const isLessonOngoing = (startTime: string, endTime?: string) => {
    const now = new Date();
    const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (!startTime) return false;
    
    // If no end time, assume 2 hours duration
    let effectiveEndTime = endTime;
    if (!effectiveEndTime) {
      const [h, m] = startTime.split(':').map(Number);
      const endH = (h + 2) % 24;
      effectiveEndTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    return currentHHmm >= startTime && currentHHmm <= effectiveEndTime;
  };
  
  const getWhatsAppUrl = (message: string) => {
    if (!settings?.whatsappNumber) return null;
    const countryCode = settings.whatsappCountryCode?.replace('+', '') || '20';
    const cleanNumber = settings.whatsappNumber.replace(/^0+/, '').replace(/\D/g, '');
    const fullNumber = `${countryCode}${cleanNumber}`;
    return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleBookingClick = (lesson: Schedule, teacher?: Teacher) => {
    const url = getWhatsAppUrl(`مرحباً، أود حجز مقعد في محاضرة ${lesson.subject} مع ${teacher?.name || 'المعلم'} ميعاد ${formatTime12h(lesson.startTime)} يوم ${getDayArabic(lesson.day)}\n\nالاسم: ${user?.displayName || ''}\nرقم هاتف الطالب: ${studentProfile?.phone || ''}`);
    if (!url) {
      toast.error('رقم الحجز غير متاح حالياً');
      return;
    }
    window.open(url, '_blank');
  };

  const handleSupportClick = () => {
    const url = getWhatsAppUrl(`مرحباً، أحتاج إلى مساعدة بخصوص المنصة.\n\nالاسم: ${user?.displayName || ''}\nالبريد الإلكتروني: ${user?.email || ''}`);
    if (!url) {
      toast.error('رقم الدعم غير متاح حالياً');
      return;
    }
    window.open(url, '_blank');
  };

  // Mandatory Profile Check
  const isProfileIncomplete = useMemo(() => {
    if (user?.role !== 'student') return false;
    if (!isProfileLoaded) return false;
    if (!studentProfile) return true;
    return !studentProfile.phone?.trim() || !studentProfile.parentPhone?.trim() || !studentProfile.gradeId;
  }, [studentProfile, isProfileLoaded, user?.role]);

  const [localStageId, setLocalStageId] = useState<string>('');

  const handleProfileComplete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phone = formData.get('phone') as string;
    const parentPhone = formData.get('parentPhone') as string;
    const name = formData.get('name') as string;
    const gradeId = formData.get('gradeId') as string;

    if (!phone || !parentPhone || !name || !gradeId) {
      toast.error('يرجى ملء جميع البيانات الإجبارية');
      return;
    }

    try {
      setLoading(true);
      
      // Update Firestore
      await setDoc(doc(db, 'students', user!.uid), {
        name,
        phone,
        parentPhone,
        gradeId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update Auth Profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }

      toast.success('تم إكمال بيانات الملف الشخصي بنجاح');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  const todaySchedules = schedules.filter(s => s.day === getCurrentDay());

  if (loading || !isProfileLoaded || (selectedGradeId && !isDataInitialized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
        <div className="w-12 h-12 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Mandatory Profile Completion Screen
  if (isProfileIncomplete) {
    return (
      <div className="min-h-screen bg-[#f7f9ff] flex items-center justify-center p-6" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-blue-50"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-[#1a73e8] mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl">person_edit</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">إكمال الملف الشخصي</h1>
            <p className="text-gray-500 font-medium">يرجى إدخال بياناتك للمتابعة</p>
          </div>

          <form onSubmit={handleProfileComplete} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الاسم بالكامل</label>
              <input
                name="name"
                type="text"
                defaultValue={studentProfile?.name || user?.displayName || ''}
                required
                className="w-full h-14 bg-gray-50 border-none rounded-2xl px-6 focus:ring-2 focus:ring-[#1a73e8] font-medium"
                placeholder="أدخل اسمك الثلاثي"
              />
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم هاتفك (واتساب)</label>
                <input
                  name="phone"
                  type="text"
                  dir="ltr"
                  required
                  className="w-full h-14 bg-gray-50 border-none rounded-2xl px-6 focus:ring-2 focus:ring-[#1a73e8] font-bold text-right"
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم هاتف ولي الأمر</label>
                <input
                  name="parentPhone"
                  type="text"
                  dir="ltr"
                  required
                  className="w-full h-14 bg-gray-50 border-none rounded-2xl px-6 focus:ring-2 focus:ring-[#1a73e8] font-bold text-right"
                  placeholder="01xxxxxxxxx"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">المرحلة الدراسية</label>
              <select
                className="w-full h-14 bg-gray-50 border-none rounded-2xl px-6 focus:ring-2 focus:ring-[#1a73e8] font-bold mb-4"
                value={localStageId}
                onChange={(e) => setLocalStageId(e.target.value)}
                required
              >
                <option value="">اختر المرحلة الدراسية</option>
                {ACADEMIC_STAGES.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>

              {localStageId && (
                <>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الصف الدراسي</label>
                  <select
                    name="gradeId"
                    required
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-6 focus:ring-2 focus:ring-[#1a73e8] font-bold"
                  >
                    <option value="">اختر صفك الدراسي</option>
                    {ACADEMIC_STAGES.find(s => s.id === localStageId)?.grades.map(grade => (
                      <option key={grade.id} value={grade.id}>{grade.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-[#1a73e8] text-white rounded-2xl font-bold text-lg hover:shadow-xl hover:shadow-blue-200 transition-all active:scale-[0.98]"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ ومتابعة'}
            </button>
          </form>

          <button 
            onClick={handleLogout}
            className="mt-8 w-full text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-50 py-2 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            إلغاء وتسجيل الخروج
          </button>
        </motion.div>
      </div>
    );
  }

  // Step 1: Stage/Grade Selection Screen
  if (!selectedGradeId) {
    const selectedStage = ACADEMIC_STAGES.find(s => s.id === selectedStageId);

    return (
      <div className="min-h-screen bg-[#f7f9ff] flex flex-col items-center justify-center p-6" dir="rtl">
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="max-w-4xl w-full text-center"
        >
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
              {selectedStage && (
                <button 
                  onClick={() => setSelectedStageId(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400 rotate-180" />
                </button>
              )}
              أهلاً بك في {settings?.systemName || 'إديو سنتر'}
            </h1>
            <p className="text-lg text-gray-500 font-medium">
              {!selectedStageId ? 'يرجى اختيار المرحلة الدراسية لمتابعة دروسك' : `اختر صفك الدراسي في ${selectedStage?.name}`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {!selectedStageId ? (
              ACADEMIC_STAGES.map((stage, idx) => (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStageId(stage.id)}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-[#1a73e8] hover:shadow-2xl hover:-translate-y-2 transition-all transition-duration-300 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#1a73e8] mx-auto mb-6 group-hover:bg-[#1a73e8] group-hover:text-white transition-all">
                      <span className="material-symbols-outlined text-3xl">school</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{stage.name}</h3>
                  </div>
                </button>
              ))
            ) : (
              selectedStage?.grades.map((grade) => (
                <button
                  key={grade.id}
                  onClick={() => setSelectedGradeId(grade.id)}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-[#1a73e8] hover:shadow-2xl hover:-translate-y-2 transition-all transition-duration-300 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#1a73e8] mx-auto mb-6 group-hover:bg-[#1a73e8] group-hover:text-white transition-all">
                      <span className="material-symbols-outlined text-3xl">local_library</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{grade.name}</h3>
                  </div>
                </button>
              ))
            )}
            
            {/* Show dynamic custom grades only on stage 1 if stageId is null */}
            {!selectedStageId && grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).map((grade) => (
              <button
                key={grade.id}
                onClick={() => setSelectedGradeId(grade.id)}
                className="bg-white p-8 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-[#1a73e8] hover:shadow-2xl hover:-translate-y-2 transition-all transition-duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#1a73e8] mx-auto mb-6 group-hover:bg-[#1a73e8] group-hover:text-white transition-all">
                    <span className="material-symbols-outlined text-3xl">local_library</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{grade.name}</h3>
                </div>
              </button>
            ))}
          </div>
          
          <button 
            onClick={handleLogout}
            className="mt-12 text-red-500 font-bold flex items-center gap-2 mx-auto hover:bg-red-50 px-6 py-2 rounded-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </motion.div>
      </div>
    );
  }

  // Step 2: Main Dashboard Screen
  return (
    <div className="min-h-screen bg-[#f7f9ff] font-sans rtl text-right flex flex-col lg:flex-row" dir="rtl">
      {/* 2. Persistent Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 bg-white border-l border-gray-100 flex-col sticky top-0 h-screen z-50 overflow-y-auto">
        <div className="p-8 border-b border-gray-50 bg-gray-50/30">
          <h1 className="text-xl font-black text-[#005bbf] leading-none">{settings?.systemName || 'إديو سنتر'}</h1>
          <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-widest">بوابة الطالب</p>
        </div>

        <div className="flex-1 p-6 space-y-2">
          {[
            { id: 'home', label: 'الرئيسية', icon: 'dashboard' },
            { id: 'schedule', label: 'الجدول الدراسي', icon: 'calendar_month' },
            { id: 'exams', label: 'الاختبارات', icon: 'quiz' },
            { id: 'subjects', label: 'المعلمون', icon: 'school' },
            { id: 'account', label: 'حسابي', icon: 'person' }
          ].map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl transition-all font-bold group",
                  active ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "hover:bg-gray-50 text-gray-600"
                )}
              >
                <span className={cn("material-symbols-outlined", active ? "text-white" : "text-gray-400 group-hover:text-blue-600")}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-50 space-y-4">
           <button
              onClick={() => {
                setSelectedGradeId(null);
                setSelectedStageId(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-gray-500 hover:text-blue-600 font-bold transition-all group"
            >
              <span className="material-symbols-outlined text-gray-300 group-hover:text-blue-600">swap_horiz</span>
              <span className="text-xs">تغيير المرحلة</span>
            </button>
            <button 
              onClick={logout}
              className="w-full h-12 bg-red-50 text-red-600 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 h-20 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-400 hover:text-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-3xl">menu</span>
            </button>
            <h2 className="text-xl font-black text-gray-900 truncate">
              {activeTab === 'home' && 'الرئيسية'}
              {activeTab === 'schedule' && 'الجدول الدراسي'}
              {activeTab === 'exams' && 'الاختبارات والحصاد'}
              {activeTab === 'subjects' && 'معلمو المركز'}
              {activeTab === 'account' && 'الملف الشخصي'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-left">
              <span className="text-sm font-black text-gray-900 leading-none">{user?.displayName}</span>
              <span className="text-[10px] text-gray-400 font-bold mt-1">طالب مسجل</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="p" className="w-full h-full object-cover" />
              ) : (
                 <div className="w-full h-full flex items-center justify-center text-blue-600 font-bold">
                  {user?.displayName?.charAt(0)}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={cn("flex-grow", activeTab === 'home' ? "" : "p-6 lg:p-10")}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Main Content */}
          <div className={`${activeTab === 'home' ? 'lg:col-span-12' : 'lg:col-span-8'} flex flex-col gap-10`}>
              
              {/* Today's Schedule Tab - New Design */}
              {activeTab === 'home' && (
                <div className="flex flex-col gap-8">
                  <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#005bbf]">
                        <span className="material-symbols-outlined text-3xl">calendar_today</span>
                      </div>
                      جدول اليوم
                    </h3>
                    <div className="text-[#005bbf] text-sm font-bold bg-blue-50 px-6 py-2 rounded-full border border-blue-100">
                      {getDayArabic(getCurrentDay())}، {new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {todaySchedules.length === 0 ? (
                      <div className="lg:col-span-3 py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-400">
                        <span className="material-symbols-outlined text-7xl mb-6 opacity-20">event_busy</span>
                        <p className="text-xl font-bold">لا توجد محاضرات مجدولة لهذا اليوم</p>
                      </div>
                    ) : (
                      todaySchedules.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((lesson, idx) => {
                        const teacher = teachers.find(t => t.id === lesson.teacherId);
                        const ongoing = isLessonOngoing(lesson.startTime, lesson.endTime);
                        return (
                          <motion.div 
                            key={lesson.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white rounded-[2.5rem] p-6 shadow-[0_15px_50px_-20px_rgba(0,0,0,0.06)] border border-gray-100 transition-all hover:shadow-2xl hover:-translate-y-2 flex flex-col relative group overflow-hidden"
                          >
                            {/* Ongoing Badge */}
                            {ongoing && (
                              <div className="absolute top-4 left-4 z-10">
                                <span className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse shadow-lg">
                                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                  جارية الآن
                                </span>
                              </div>
                            )}

                            {/* Card Content - Vertical Stack */}
                            <div className="flex flex-col items-center text-center mb-6 pt-4">
                              <div className="relative mb-6">
                                {teacher?.photoURL ? (
                                  <img src={teacher.photoURL} alt={teacher.name} className="w-24 h-24 rounded-[2rem] object-cover ring-8 ring-blue-50 group-hover:ring-blue-100 transition-all shadow-xl" />
                                ) : (
                                  <div className="w-24 h-24 rounded-[2rem] bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-3xl ring-8 ring-blue-50">
                                    {teacher?.name?.charAt(0)}
                                  </div>
                                )}
                                {ongoing && (
                                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#86f898] rounded-2xl border-4 border-white flex items-center justify-center shadow-lg">
                                    <span className="material-symbols-outlined text-lg text-[#00722f]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  </div>
                                )}
                              </div>
                              
                              <h4 className="text-2xl font-black text-gray-900 mb-2 group-hover:text-[#005bbf] transition-colors">{lesson.subject}</h4>
                              <p className="text-gray-500 font-bold mb-4">{teacher?.name}</p>
                              
                              <div className={`px-6 py-2 rounded-2xl inline-flex flex-col items-center ${ongoing ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-gray-50 text-gray-400 font-bold border border-gray-100'}`}>
                                <span className="text-xl font-black leading-none">{formatTime12h(lesson.startTime).split(' ')[0]}</span>
                                <span className="text-[10px] uppercase tracking-widest">{formatTime12h(lesson.startTime).split(' ')[1]}</span>
                              </div>
                            </div>

                            <div className="mt-auto pt-6 border-t border-gray-50 flex flex-col gap-4">
                              <div className="flex items-center justify-center gap-2 text-gray-500 bg-gray-50/50 py-3 rounded-2xl">
                                <span className="material-symbols-outlined text-xl">location_on</span>
                                <span className="text-sm font-bold tracking-tight">{lesson.room || 'القاعة الرئيسية'}</span>
                              </div>
                              <button 
                                onClick={() => handleBookingClick(lesson, teacher)}
                                className="bg-[#006e2c] text-white font-bold h-14 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#005320] shadow-xl shadow-green-100 transition-all active:scale-95 group-hover:scale-[1.02]"
                              >
                                <Search className="w-5 h-5" />
                                حجز مقعدك الآن
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>

                  {/* Move Sidebar content here for Home Tab */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    {/* Important Alerts - Dynamic from Settings matched to Image Shape */}
                    {settings?.alertsEnabled && settings?.alertsContent && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50 flex flex-col h-full"
                      >
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-red-500 text-2xl">notifications_active</span>
                            <h3 className="text-2xl font-black text-gray-900">تنبيهات هامة</h3>
                          </div>
                        </div>
                        
                        <div className="space-y-4 flex-1">
                          {settings.alertsContent.split('\n\n').filter(Boolean).map((alertBlock, idx) => {
                            const lines = alertBlock.split('\n').filter(Boolean);
                            const title = lines[0];
                            const subtitle = lines.slice(1).join(' ');
                            const isEven = idx % 2 === 0;
                            
                            return (
                              <div 
                                key={idx}
                                className={cn(
                                  "p-4 rounded-3xl border flex items-center justify-between transition-all hover:scale-[1.02] cursor-default",
                                  isEven 
                                    ? "bg-[#FFF5F5] border-[#FFEBEB]" 
                                    : "bg-[#F0F7FF] border-[#E1EFFF]"
                                )}
                              >
                                <div className="flex-1 px-4 text-right">
                                  <p className={cn(
                                    "text-lg font-bold leading-tight",
                                    isEven ? "text-[#4A0E0E]" : "text-[#0E2A4A]"
                                  )}>
                                    {title}
                                  </p>
                                  {subtitle && (
                                    <p className={cn(
                                      "text-sm mt-1 font-medium",
                                      isEven ? "text-[#A66E6E]" : "text-[#6E86A6]"
                                    )}>
                                      {subtitle}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0">
                                  <span className={cn(
                                    "material-symbols-outlined text-2xl font-bold",
                                    isEven ? "text-[#FF4B4B]" : "text-[#0066FF]"
                                  )}>
                                    {isEven ? 'priority_high' : 'calendar_month'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Help Card */}
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative overflow-hidden rounded-[2.5rem] h-full min-h-[220px] bg-gradient-to-br from-[#1a202c] to-[#2d3748] text-white flex flex-col justify-center p-10 shadow-2xl"
                    >
                      <div className="relative z-10">
                        <h3 className="text-3xl font-bold mb-3">تحتاج مساعدة؟</h3>
                        <p className="text-sm opacity-80 mb-6 font-medium leading-relaxed">فريق الدعم الفني والمرشدين الأكاديميين متاحون طوال اليوم لمساعدتك.</p>
                        <button 
                          onClick={handleSupportClick}
                          className="bg-[#1a73e8] px-10 py-4 rounded-2xl text-base font-bold hover:bg-blue-600 shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-3 w-fit"
                        >
                          <MessageSquare className="w-5 h-5" />
                          تواصل مع الدعم الفني الآن
                        </button>
                      </div>
                      <span className="material-symbols-outlined absolute -bottom-8 -left-8 text-[12rem] opacity-[0.03] rotate-12">support_agent</span>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Weekly Schedule Tab */}
              {activeTab === 'schedule' && (
                <div className="flex flex-col gap-6">
                  <h3 className="text-2xl font-bold text-gray-900">الجدول الأسبوعي</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
                      const dayLessons = schedules.filter(s => s.day === day);
                      return (
                        <div key={day} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <h4 className="font-bold text-[#1a73e8] mb-4 pb-2 border-b border-blue-50">{getDayArabic(day)}</h4>
                          <div className="space-y-4">
                            {dayLessons.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">لا توجد محاضرات في هذا اليوم</p>
                            ) : (
                              dayLessons.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(lesson => (
                                <div key={lesson.id} className="flex justify-between items-center text-sm">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">{lesson.subject}</span>
                                    <span className="text-[10px] text-gray-500">{lesson.room}</span>
                                  </div>
                                  <div className={`px-3 py-1 rounded-lg text-[10px] font-bold ${lesson.isExam ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {formatTime12h(lesson.startTime)}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exams Tab */}
              {activeTab === 'exams' && (
                <div className="flex flex-col gap-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-6 font-bold">
                       <span className="material-symbols-outlined text-4xl">quiz</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">الاختبارات والتقييمات</h3>
                    <p className="text-gray-500 max-w-md mx-auto">هنا ستجد اختباراتك القادمة، نتائج الامتحانات، والتقارير الشهرية لمتابعة مستواك الدراسي.</p>
                    
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-right">
                      <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-2 text-blue-600">
                          <span className="material-symbols-outlined">assignment</span>
                          <span className="font-bold text-sm">الاختبارات القادمة</span>
                        </div>
                        <p className="text-xs text-gray-400">لا توجد اختبارات مجدولة حالياً لمادتك المختارة.</p>
                      </div>
                      <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-2 text-green-600">
                          <span className="material-symbols-outlined">analytics</span>
                          <span className="font-bold text-sm">نتائج الاختبارات</span>
                        </div>
                        <p className="text-xs text-gray-400">سيتم عرض نتائج اختباراتك الشهرية فور تصحيحها هنا.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subjects & Teachers Tab */}
              {activeTab === 'subjects' && (
                <div className="flex flex-col gap-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">المعلمون</h3>
                        <p className="text-gray-500 text-sm">استكشف نخبة من المعلمين المتميزين في كافة التخصصات.</p>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setIsFilterOpen(!isFilterOpen)}
                          className="flex items-center gap-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-600 transition-all font-bold group border border-gray-100"
                        >
                          <Filter className="w-5 h-5 text-gray-400 group-hover:text-[#1a73e8]" />
                          <span>{selectedSubject || 'كل التخصصات'}</span>
                          <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform", isFilterOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                          {isFilterOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setIsFilterOpen(false)}
                              />
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute left-0 mt-3 w-64 bg-white border border-gray-100 rounded-3xl shadow-2lx z-20 overflow-hidden"
                              >
                                <div className="p-3 space-y-1">
                                  <button
                                    onClick={() => {
                                      setSelectedSubject(null);
                                      setIsFilterOpen(false);
                                    }}
                                    className={cn(
                                      "w-full text-right px-5 py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-between",
                                      selectedSubject === null ? "bg-blue-50 text-[#1a73e8]" : "text-gray-600 hover:bg-gray-50"
                                    )}
                                  >
                                    <span>الكل</span>
                                    {selectedSubject === null && <Check className="w-4 h-4" />}
                                  </button>
                                  {subjects.map(sub => (
                                    <button
                                      key={sub}
                                      onClick={() => {
                                        setSelectedSubject(sub);
                                        setIsFilterOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-right px-5 py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-between",
                                        selectedSubject === sub ? "bg-blue-50 text-[#1a73e8]" : "text-gray-600 hover:bg-gray-50"
                                      )}
                                    >
                                      <span>{sub}</span>
                                      {selectedSubject === sub && <Check className="w-4 h-4" />}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Teachers Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-8">
                    <AnimatePresence mode="wait">
                      {filteredTeachers.map((teacher, idx) => (
                        <motion.div
                          key={teacher.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-white rounded-3xl overflow-hidden shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-xl transition-all group border border-gray-50 flex flex-col"
                        >
                          {/* Image & Status */}
                          <div className="h-48 relative overflow-hidden">
                            {teacher.photoURL ? (
                              <img src={teacher.photoURL} alt={teacher.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-200">
                                <span className="material-symbols-outlined text-6xl">person</span>
                              </div>
                            )}
                            <div className="absolute top-4 left-4 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                              متصل الآن
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-6 flex flex-col flex-1">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h5 className="text-xl font-bold text-gray-900 group-hover:text-[#1a73e8] transition-colors">{teacher.name}</h5>
                                <p className="text-sm text-gray-400 font-medium">{teacher.subject}</p>
                              </div>
                              <div className="flex items-center gap-1 bg-yellow-50 text-yellow-600 px-2 py-1 rounded-lg">
                                <span className="material-symbols-outlined text-sm filled">star</span>
                                <span className="text-xs font-bold">4.9</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-6">
                              <span className="bg-gray-50 text-gray-500 text-[10px] font-bold px-3 py-1 rounded-lg">ثانوية عامة</span>
                              <span className="bg-gray-50 text-gray-500 text-[10px] font-bold px-3 py-1 rounded-lg">10 سنوات خبرة</span>
                            </div>

                            <div className="flex gap-3 mt-auto">
                              <button 
                                onClick={() => setSelectedTeacherProfile(teacher)}
                                className="flex-1 h-12 rounded-2xl bg-[#1a73e8] text-white text-sm font-bold hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95"
                              >
                                عرض الملف الشخصي
                              </button>
                              <button className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-[#1a73e8] hover:text-white transition-all active:scale-95">
                                <span className="material-symbols-outlined text-xl">mail</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Account Tab */}
              {activeTab === 'account' && (
                <div className="flex flex-col gap-8">
                  <h3 className="text-2xl font-bold text-gray-900">الملف الشخصي</h3>
                  
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full border-4 border-blue-50 shadow-lg overflow-hidden mb-6">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600 text-3xl font-bold">
                          {user?.displayName?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-1">{user?.displayName}</h4>
                    <p className="text-sm text-gray-500 mb-6">{user?.email}</p>
                    
                    <div className="w-full grid grid-cols-1 gap-4 max-w-sm">
                      <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                        <span className="text-sm text-gray-500 font-bold">المرحلة الدراسية</span>
                        <span className="text-sm font-bold text-[#1a73e8]">
                          {(() => {
                            const stage = ACADEMIC_STAGES.find(s => s.grades.some(g => g.id === selectedGradeId));
                            const grade = stage?.grades.find(g => g.id === selectedGradeId) || grades.find(g => g.id === selectedGradeId);
                            return grade ? grade.name : (selectedGradeId === 'primary' ? 'المرحلة الابتدائية' : selectedGradeId);
                          })()}
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedGradeId(null);
                          setSelectedStageId(null);
                        }}
                        className="w-full h-12 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all font-bold text-sm"
                      >
                        تغيير المرحلة الدراسية
                      </button>
                      <button 
                        onClick={logout}
                        className="w-full h-12 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all font-bold text-sm mt-4"
                      >
                        تسجيل الخروج
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Content */}
            <div className={`lg:col-span-4 flex flex-col gap-6 ${activeTab !== 'subjects' && activeTab !== 'schedule' && activeTab !== 'exams' && activeTab !== 'account' ? 'hidden' : 'flex'}`}>
              {/* Important Alerts */}
              {activeTab !== 'account' && settings?.alertsEnabled && settings?.alertsContent && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-50">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">تنبيهات هامة</h3>
                  <div className="space-y-4">
                    {settings.alertsContent.split('\n\n').filter(Boolean).map((alertBlock, idx) => {
                      const lines = alertBlock.split('\n').filter(Boolean);
                      const title = lines[0];
                      const subtitle = lines.slice(1).join(' ');
                      const isRed = idx % 2 === 0;
                      
                      return (
                        <div key={idx} className={cn("flex gap-4 p-3 rounded-lg", isRed ? "bg-red-50" : "bg-blue-50")}>
                          <span className={cn("material-symbols-outlined", isRed ? "text-red-500" : "text-blue-600")}>
                            {isRed ? "priority_high" : "event"}
                          </span>
                          <div>
                            <p className={cn("text-sm font-bold", isRed ? "text-red-900" : "text-blue-900")}>{title}</p>
                            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Help Card */}
              <div className="relative overflow-hidden rounded-xl h-48 bg-[#151c24] text-white flex items-center p-8">
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-2">تحتاج مساعدة؟</h3>
                  <p className="text-xs opacity-80 mb-4">تواصل مع فريق الدعم الآن للحصول على مساعدة.</p>
                  <button 
                    onClick={handleSupportClick}
                    className="bg-[#1a73e8] px-6 py-2 rounded-full text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    مراسلة الدعم
                  </button>
                </div>
                <span className="material-symbols-outlined absolute -bottom-4 -left-4 text-9xl opacity-10">support_agent</span>
              </div>
            </div>
          </div>
        </main>

      {/* Bottom Display Navigation (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] lg:hidden">
        {/* Home */}
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center transition-all px-4 py-2 ${activeTab === 'home' ? 'text-[#001a41]' : 'text-gray-400'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'home' ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
          <span className="text-[9px] font-black mt-1">الرئيسية</span>
          {activeTab === 'home' && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1" />}
        </button>

        {/* Schedule */}
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center justify-center transition-all px-4 py-2 ${activeTab === 'schedule' ? 'text-[#001a41]' : 'text-gray-400'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'schedule' ? "'FILL' 1" : "'FILL' 0" }}>calendar_month</span>
          <span className="text-[9px] font-black mt-1">الجدول</span>
          {activeTab === 'schedule' && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1" />}
        </button>

        {/* Exams */}
        <button 
          onClick={() => setActiveTab('exams')}
          className={`flex flex-col items-center justify-center transition-all px-4 py-2 ${activeTab === 'exams' ? 'text-[#001a41]' : 'text-gray-400'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'exams' ? "'FILL' 1" : "'FILL' 0" }}>quiz</span>
          <span className="text-[9px] font-black mt-1">الاختبارات</span>
          {activeTab === 'exams' && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1" />}
        </button>

        {/* Subjects */}
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`flex flex-col items-center justify-center transition-all px-4 py-2 ${activeTab === 'subjects' ? 'text-[#001a41]' : 'text-gray-400'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'subjects' ? "'FILL' 1" : "'FILL' 0" }}>school</span>
          <span className="text-[9px] font-black mt-1">المعلمون</span>
          {activeTab === 'subjects' && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1" />}
        </button>

        {/* Profile */}
        <button 
          onClick={() => setActiveTab('account')}
          className={`flex flex-col items-center justify-center transition-all px-4 py-2 ${activeTab === 'account' ? 'text-[#001a41]' : 'text-gray-400'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'account' ? "'FILL' 1" : "'FILL' 0" }}>person</span>
          <span className="text-[9px] font-black mt-1">حسابي</span>
          {activeTab === 'account' && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1" />}
        </button>
      </nav>

      {/* Footer (Desktop Only) */}
      <footer className="hidden md:flex w-full py-md px-gutter flex flex-col items-center max-w-7xl mx-auto mb-20 border-t border-gray-100 opacity-60">
        <p className="text-xs text-gray-400">© {settings?.systemName || 'إديو سنتر'} {new Date().getFullYear()}. جميع الحقوق محفوظة.</p>
        <div className="flex gap-4 mt-2">
          <button className="text-xs text-[#005bbf]">عن المنصة</button>
          <span className="text-gray-300">•</span>
          <button className="text-xs text-[#005bbf]">الدعم الفني</button>
        </div>
      </footer>
    </div>
  </div>
  );
}
