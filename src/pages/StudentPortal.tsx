import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Grade, Schedule, Group, Teacher } from '../types';
import { ACADEMIC_STAGES } from '../constants';
import { LogOut, Search, Clock, MapPin, Send, MessageSquare, AlertCircle, Facebook, Instagram, Twitter, Youtube, Phone, Info, Star, ShieldCheck, Mail, Share2, X, ChevronDown, Filter, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Button, Card, Badge, Input, cn } from '../components/ui';

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
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [isTakingExam, setIsTakingExam] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examStartTime, setExamStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState('');
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

    const unsubExams = onSnapshot(
      query(collection(db, 'exams'), where('gradeId', '==', selectedGradeId)),
      (snapshot) => {
        setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'exams')
    );

    return () => {
      unsubSchedules();
      unsubGroups();
      unsubExams();
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

  const todaySchedules = useMemo(() => {
    return schedules.filter(s => s.day === getCurrentDay());
  }, [schedules]);

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

  // Exam timer logic
  useEffect(() => {
    if (!isTakingExam || !selectedExam || !timeLeft) return;

    if (timeLeft <= 0) {
      toast.error('انتهى وقت الاختبار!');
      handleSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [isTakingExam, timeLeft]);

  const formatTimeLeft = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  const handleSubmitExam = async () => {
    if (!selectedExam) return;

    try {
      // Calculate score
      let score = 0;
      let questions = selectedExam.questions || [];
      
      // Fallback if questions are stored as a JSON string
      if (typeof questions === 'string') {
        try {
          questions = JSON.parse(questions);
        } catch (e) {
          questions = [];
        }
      }

      (questions || []).forEach((q: any, idx: number) => {
        if (examAnswers[idx] === q.correctAnswer) {
          score += Number(q.marks || 0);
        }
      });

      const resultData = {
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        studentId: user?.uid,
        studentName: user?.displayName,
        score,
        totalMarks: selectedExam.totalMarks,
        answers: examAnswers,
        completedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'exam_results'), resultData);
      
      toast.success(`تم تسليم الاختبار بنجاح! درجتك: ${score}/${selectedExam.totalMarks}`);
      setIsTakingExam(false);
      setSelectedExam(null);
      setTimeLeft(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'exam_results');
    }
  };

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
      {/* 1. Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:flex w-72 bg-white border-l border-gray-100 flex-col sticky top-0 h-screen z-50">
        <div className="p-8 flex items-center gap-4 border-b border-gray-50 bg-[#005bbf]">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white font-black text-2xl border border-white/30 backdrop-blur-md">
            {user?.displayName?.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white leading-tight truncate">{settings?.systemName || 'إديو سنتر'}</h1>
            <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest leading-none">بوابة الطالب</p>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3 mt-4">
          {[
            { id: 'home', label: 'الرئيسية', icon: 'dashboard' },
            { id: 'schedule', label: 'الجدول الدراسي', icon: 'calendar_month' },
            { id: 'exams', label: 'الاختبارات', icon: 'quiz' },
            { id: 'subjects', label: 'المعلمون', icon: 'school' },
            { id: 'account', label: 'حسابي', icon: 'person' }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={cn("w-full h-14 flex items-center gap-4 px-6 rounded-2xl font-black text-sm transition-all text-right", activeTab === item.id ? "bg-blue-50 text-[#005bbf] shadow-sm" : "hover:bg-gray-50 text-gray-500")}>
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: activeTab === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          
          <div className="pt-4 mt-2 border-t border-gray-50">
            <button
              onClick={() => {
                setSelectedGradeId(null);
                setSelectedStageId(null);
              }}
              className="w-full h-14 flex items-center gap-4 px-6 rounded-2xl text-gray-500 font-black text-sm hover:bg-blue-50 hover:text-blue-600 transition-all group text-right"
            >
              <span className="material-symbols-outlined text-2xl group-hover:rotate-180 transition-transform">swap_horiz</span>
              <span>تغيير المرحلة</span>
            </button>
          </div>
        </nav>

        <div className="p-6 border-t border-gray-50">
          <button onClick={handleLogout} className="w-full h-14 flex items-center gap-4 px-6 rounded-2xl text-red-500 font-black text-sm hover:bg-red-50 transition-all text-right">
            <span className="material-symbols-outlined text-2xl">logout</span>
            <span>خروج آمن</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* 2. Header */}
        <header className="bg-[#005bbf] shadow-md sticky top-0 z-40">
          <div className="flex justify-between items-center px-6 md:px-10 w-full h-16 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden text-white hover:bg-white/10 transition-colors p-2 rounded-xl"
              >
                <span className="material-symbols-outlined text-2xl">menu</span>
              </button>
              <h1 className="text-lg md:text-xl font-bold text-white leading-none tracking-tight lg:hidden">{settings?.systemName || 'إديو سنتر'}</h1>
              <div className="hidden lg:block text-white font-bold text-sm tracking-wide">
                لوحة تحكم الطالب • {
                  activeTab === 'home' ? 'الرئيسية' :
                  activeTab === 'schedule' ? 'الجدول الدراسي' :
                  activeTab === 'exams' ? 'الاختبارات والنتائج' :
                  activeTab === 'subjects' ? 'قائمة المعلمين' :
                  activeTab === 'account' ? 'الملف الشخصي' : ''
                }
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end">
                <p className="text-[10px] text-white/60 font-black uppercase tracking-widest leading-none mb-1">المستخدم الحالي</p>
                <p className="text-sm font-bold text-white leading-none">{user?.displayName}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden border border-white/30 backdrop-blur-md shadow-lg">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center text-white font-black text-sm">{user?.displayName?.charAt(0)}</div>
                )}
              </div>
            </div>
          </div>
        </header>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-80 bg-white z-[70] shadow-2xl flex flex-col p-6 rtl"
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-blue-600 font-black text-xl bg-blue-50">
                        {user?.displayName?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-gray-900 truncate leading-tight">{user?.displayName}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                >
                  <X className="w-6 h-6 text-gray-400 group-hover:text-red-500 transition-colors" />
                </button>
              </div>

              <div className="flex-grow space-y-2">
                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setActiveTab('home');
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold group",
                    activeTab === 'home' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "hover:bg-gray-50 text-gray-700"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", activeTab === 'home' ? "bg-white/20" : "bg-gray-50 group-hover:bg-gray-100")}>
                    <span className="material-symbols-outlined">dashboard</span>
                  </div>
                  <span>الرئيسية</span>
                </button>

                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setActiveTab('schedule');
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold group",
                    activeTab === 'schedule' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "hover:bg-gray-50 text-gray-700"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", activeTab === 'schedule' ? "bg-white/20" : "bg-gray-50 group-hover:bg-gray-100")}>
                    <span className="material-symbols-outlined">calendar_month</span>
                  </div>
                  <span>الجدول الدراسي</span>
                </button>

                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setActiveTab('exams');
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold group",
                    activeTab === 'exams' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "hover:bg-gray-50 text-gray-700"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", activeTab === 'exams' ? "bg-white/20" : "bg-gray-50 group-hover:bg-gray-100")}>
                    <span className="material-symbols-outlined">quiz</span>
                  </div>
                  <span>الاختبارات</span>
                </button>

                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setActiveTab('subjects');
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold group",
                    activeTab === 'subjects' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "hover:bg-gray-50 text-gray-700"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", activeTab === 'subjects' ? "bg-white/20" : "bg-gray-50 group-hover:bg-gray-100")}>
                    <span className="material-symbols-outlined">school</span>
                  </div>
                  <span>المعلمون</span>
                </button>

                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setActiveTab('account');
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold group",
                    activeTab === 'account' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "hover:bg-gray-50 text-gray-700"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", activeTab === 'account' ? "bg-white/20" : "bg-gray-50 group-hover:bg-gray-100")}>
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <span>حسابي</span>
                </button>

                <div className="pt-4 mt-2 border-t border-gray-50">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setSelectedGradeId(null);
                      setSelectedStageId(null);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-bold transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <span className="material-symbols-outlined text-gray-400 group-hover:text-blue-600">swap_horiz</span>
                    </div>
                    <span>تغيير المرحلة الدراسية</span>
                  </button>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-gray-50 space-y-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-red-50 text-red-500 font-black transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="pb-32">
        {selectedTeacherProfile ? (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-4xl mx-auto px-6 py-12 pb-32"
          >
            {/* Back Button */}
            <button 
              onClick={() => setSelectedTeacherProfile(null)}
              className="flex items-center gap-2 text-gray-500 hover:text-[#005bbf] font-bold mb-8 transition-colors group"
            >
              <X className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              العودة لقائمة المعلمين
            </button>

            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-50">
              {/* Header/Cover */}
              <div className="h-48 bg-[#005bbf] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24" />
                </div>
              </div>

              {/* Profile Image */}
              <div className="px-12 -mt-20 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="w-40 h-40 rounded-3xl border-8 border-white bg-white shadow-2xl overflow-hidden flex items-center justify-center">
                  {selectedTeacherProfile.photoURL ? (
                    <img src={selectedTeacherProfile.photoURL} alt={selectedTeacherProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-5xl">
                      {selectedTeacherProfile.name.charAt(0)}
                    </div>
                  )}
                </div>
                
                <div className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-green-500 w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                    <span className="text-green-600 font-bold text-sm">متصل الآن</span>
                  </div>
                  <h3 className="text-4xl font-bold text-gray-900 mb-1">{selectedTeacherProfile.name}</h3>
                  <p className="text-[#005bbf] font-bold text-xl">{selectedTeacherProfile.subject}</p>
                </div>
              </div>

              {/* Details */}
              <div className="p-12 pt-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  <div className="p-6 bg-gray-50 rounded-3xl flex items-center gap-4 border border-transparent hover:border-blue-100 transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">رقم الهاتف</p>
                      <p className="text-sm font-bold text-gray-900" dir="ltr">{selectedTeacherProfile.phone}</p>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-gray-50 rounded-3xl flex items-center gap-4 border border-transparent hover:border-blue-100 transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center">
                      <Star className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">التقييم</p>
                      <p className="text-sm font-bold text-gray-900">4.9 / 5.0</p>
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50 rounded-3xl flex items-center gap-4 border border-transparent hover:border-blue-100 transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">الخبرة</p>
                      <p className="text-sm font-bold text-gray-900">{selectedTeacherProfile.experience || 'خبير تعليمي'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-10">
                    {/* Bio */}
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                        <span className="w-2 h-8 bg-[#005bbf] rounded-full"></span>
                        نبذة تعريفية
                      </h4>
                      <div className="text-gray-600 leading-relaxed text-lg bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100">
                        {selectedTeacherProfile.bio || 'لا توجد نبذة تعريفية مضافة لهذا المعلم حالياً.'}
                      </div>
                    </div>

                    {/* Chat Button */}
                    <button 
                      onClick={() => toast.success('سيتوفر خيار المراسلة قريباً')}
                      className="w-full h-16 rounded-2xl bg-[#005bbf] text-white font-bold text-lg flex items-center justify-center gap-4 hover:shadow-2xl hover:shadow-blue-200 transition-all active:scale-[0.98] shadow-lg shadow-blue-100"
                    >
                      <Mail className="w-6 h-6" />
                      إرسال رسالة مباشرة للمعلم
                    </button>
                  </div>

                  <div className="space-y-10">
                    {/* Social Links */}
                    {selectedTeacherProfile.socialLinks && Object.values(selectedTeacherProfile.socialLinks).some(link => link) && (
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                          <span className="w-2 h-8 bg-pink-500 rounded-full"></span>
                          تواصل معي
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedTeacherProfile.socialLinks.facebook && (
                            <a href={selectedTeacherProfile.socialLinks.facebook} target="_blank" rel="noreferrer" className="h-16 rounded-2xl bg-[#e7f3ff] text-[#1877f2] flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                              <Facebook className="w-7 h-7" />
                            </a>
                          )}
                          {selectedTeacherProfile.socialLinks.instagram && (
                            <a href={selectedTeacherProfile.socialLinks.instagram} target="_blank" rel="noreferrer" className="h-16 rounded-2xl bg-[#fff0f0] text-[#e4405f] flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                              <Instagram className="w-7 h-7" />
                            </a>
                          )}
                          {selectedTeacherProfile.socialLinks.youtube && (
                            <a href={selectedTeacherProfile.socialLinks.youtube} target="_blank" rel="noreferrer" className="h-16 rounded-2xl bg-[#ffe6e6] text-[#ff0000] flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                              <Youtube className="w-7 h-7" />
                            </a>
                          )}
                          {selectedTeacherProfile.socialLinks.twitter && (
                            <a href={selectedTeacherProfile.socialLinks.twitter} target="_blank" rel="noreferrer" className="h-16 rounded-2xl bg-[#e8f5fd] text-[#1da1f2] flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                              <Twitter className="w-7 h-7" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats or Badges */}
                    <div className="bg-gray-900 rounded-[2rem] p-8 text-white">
                      <h4 className="font-bold text-lg mb-6">إحصائيات المعلم</h4>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">عدد الطلاب</span>
                          <span className="font-bold">1,240+</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">المحاضرات المنشورة</span>
                          <span className="font-bold">85+</span>
                        </div>
                        <div className="pt-4 border-t border-gray-800">
                          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">الوسم التعليمي</p>
                          <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold border border-blue-600/30">
                            معلم معتمد
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {activeTab === 'home' && (
              <section className="bg-gradient-to-br from-[#1a73e8] to-[#005bbf] pt-12 pb-24 px-6 text-white rounded-b-[48px] shadow-2xl">
                <div className="max-w-7xl mx-auto text-center md:text-right">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <p className="text-lg opacity-80 mb-2 font-medium">مرحباً بك مجدداً،</p>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">{user?.displayName}</h2>
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-2xl p-4 inline-flex border border-white/10 shadow-lg">
                      <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.4)]">
                        <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                      </div>
                      <span className="text-sm md:text-base font-bold">جدولك الدراسي المزدحم بانتظارك! نتمنى لك يوماً موفقاً.</span>
                    </div>
                  </motion.div>
                </div>
              </section>
            )}

            {/* Content Area */}
            <section className={`max-w-7xl mx-auto px-6 pb-24 ${activeTab === 'home' ? '-mt-12' : 'mt-8'}`}>
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
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                          <span className="material-symbols-outlined text-3xl">quiz</span>
                       </div>
                       <div>
                          <h3 className="text-2xl font-bold text-gray-900">الاختبارات والتقييمات</h3>
                          <p className="text-gray-500 text-sm">استعد لاختباراتك القادمة وتابع نتائجك.</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {exams.length === 0 ? (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-300">
                          <span className="material-symbols-outlined text-6xl mb-4 opacity-20">assignment_late</span>
                          <p className="font-bold opacity-40">لا توجد اختبارات متاحة حالياً لصفك الدراسي.</p>
                        </div>
                      ) : (
                        exams.map(exam => (
                          <div key={exam.id} className="bg-gray-50/50 border border-gray-100 p-6 rounded-3xl flex flex-col hover:bg-white hover:shadow-xl transition-all group">
                             <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                   <span className="material-symbols-outlined">description</span>
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase bg-white px-3 py-1 rounded-full">{exam.duration} دقيقة</span>
                             </div>
                             <h4 className="text-lg font-bold text-gray-900 mb-2 truncate">{exam.title}</h4>
                             <p className="text-xs text-gray-400 font-bold mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">person</span>
                                {exam.teacherName}
                             </p>
                             
                             <button
                               onClick={() => setSelectedExam(exam)}
                               className="mt-auto h-12 rounded-2xl bg-white border border-blue-100 text-[#005bbf] text-sm font-black hover:bg-[#005bbf] hover:text-white transition-all shadow-sm"
                             >
                               دخول الاختبار
                             </button>
                          </div>
                        ))
                      )}
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
        </section>
          </>
        )}
      </main>

      {/* Bottom Display Navigation - New Design */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] rounded-t-3xl md:bg-transparent md:border-none md:shadow-none md:static md:max-w-7xl md:mx-auto md:px-6 md:pb-8">
        {/* Home (Active/Normal) */}
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center transition-all px-2 py-2 rounded-2xl ${activeTab === 'home' ? 'bg-[#d8e2ff] text-[#001a41]' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'home' ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
          <span className="text-[10px] font-bold mt-1">الرئيسية</span>
        </button>

        {/* Schedule */}
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center justify-center transition-all px-2 py-2 rounded-2xl ${activeTab === 'schedule' ? 'bg-[#d8e2ff] text-[#001a41]' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'schedule' ? "'FILL' 1" : "'FILL' 0" }}>calendar_month</span>
          <span className="text-[10px] font-bold mt-1">الجدول</span>
        </button>

        {/* Exams */}
        <button 
          onClick={() => setActiveTab('exams')}
          className={`flex flex-col items-center justify-center transition-all px-2 py-2 rounded-2xl ${activeTab === 'exams' ? 'bg-[#d8e2ff] text-[#001a41]' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'exams' ? "'FILL' 1" : "'FILL' 0" }}>quiz</span>
          <span className="text-[10px] font-bold mt-1">الاختبارات</span>
        </button>

        {/* Subjects */}
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`flex flex-col items-center justify-center transition-all px-2 py-2 rounded-2xl ${activeTab === 'subjects' ? 'bg-[#d8e2ff] text-[#001a41]' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'subjects' ? "'FILL' 1" : "'FILL' 0" }}>school</span>
          <span className="text-[10px] font-bold mt-1">المعلمون</span>
        </button>

        {/* Profile */}
        <button 
          onClick={() => setActiveTab('account')}
          className={`flex flex-col items-center justify-center transition-all px-2 py-2 rounded-2xl ${activeTab === 'account' ? 'bg-[#d8e2ff] text-[#001a41]' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'account' ? "'FILL' 1" : "'FILL' 0" }}>person</span>
          <span className="text-[10px] font-bold mt-1">حسابي</span>
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
      {/* Exam Access Modal */}
      <AnimatePresence>
        {selectedExam && !isTakingExam && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedExam(null)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-xl z-[100]" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[3rem] p-10 z-[110] shadow-2xl" dir="rtl">
              <div className="text-center mb-8">
                 <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 mx-auto mb-6 shadow-xl shadow-blue-50/50">
                    <span className="material-symbols-outlined text-4xl">lock</span>
                 </div>
                 <h3 className="text-2xl font-black text-gray-900 mb-2">رمز دخول الاختبار</h3>
                 <p className="text-gray-400 font-bold text-sm">يرجى إدخال الرمز السري الذي حصلت عليه من المعلم للدخول لاختبار: <br/><span className="text-blue-600">{selectedExam.title}</span></p>
              </div>

              <div className="space-y-6">
                <input 
                  type="text"
                  value={accessCodeInput}
                  onChange={e => setAccessCodeInput(e.target.value)}
                  placeholder="أدخل رمز الدخول هنا..."
                  className="w-full h-16 bg-gray-50 rounded-2xl border-none px-8 font-black text-center text-xl tracking-widest focus:ring-4 focus:ring-blue-100 uppercase"
                />
                
                <div className="flex gap-4">
                  <button onClick={() => {
                    if (accessCodeInput.trim().toUpperCase() === (selectedExam.accessCode || '').toUpperCase()) {
                      toast.success('تم التحقق بنجاح! جاري تحميل الاختبار...');
                      setExamStartTime(Date.now());
                      setExamAnswers({});
                      const durationInSeconds = Number(selectedExam.duration || 60) * 60;
                      setTimeLeft(durationInSeconds);
                      setIsTakingExam(true);
                      setAccessCodeInput('');
                    } else {
                      toast.error('رمز الدخول غير صحيح، يرجى التأكد وإعادة المحاولة');
                    }
                  }} className="flex-1 h-14 bg-[#005bbf] text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-200">دخول الاختبار</button>
                  <button onClick={() => setSelectedExam(null)} className="flex-1 h-14 bg-gray-50 text-gray-500 rounded-2xl font-black text-sm">إلغاء</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Taking Exam View */}
      <AnimatePresence>
        {isTakingExam && selectedExam && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-white z-[200] overflow-y-auto" dir="rtl">
            <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
              <div className="max-w-4xl mx-auto px-6 h-20 flex justify-between items-center">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-black transition-colors",
                      timeLeft && timeLeft < 300 ? "bg-red-50 text-red-600 animate-pulse" : "bg-blue-50 text-blue-600"
                    )}>
                      <span className="material-symbols-outlined">timer</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-gray-900 leading-none">{selectedExam.title}</h2>
                      <p className={cn(
                        "text-xs font-black mt-1",
                        timeLeft && timeLeft < 300 ? "text-red-500" : "text-blue-600"
                      )}>
                        الوقت المتبقي: {timeLeft !== null ? formatTimeLeft(timeLeft) : '--:--'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      if(confirm('هل أنت متأكد من إنهاء الاختبار وتسليم الإجابات؟')) {
                        handleSubmitExam();
                      }
                    }} 
                    className="h-12 px-8 rounded-2xl font-black bg-[#005bbf] shadow-xl shadow-blue-200"
                  >
                    إنهاء وتسليم
                  </Button>
                </div>
              </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-10 pb-32">
              <div className="space-y-12">
                {(() => {
                  let questions = selectedExam.questions || [];
                  if (typeof questions === 'string') {
                    try {
                      questions = JSON.parse(questions);
                    } catch (e) {
                      questions = [];
                    }
                  }
                  
                  if (questions && questions.length > 0) {
                    return questions.map((q: any, qIdx: number) => (
                      <div key={qIdx} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex gap-4">
                          <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-black text-sm shrink-0 mt-1">{qIdx + 1}</div>
                          <p className="text-xl font-black text-gray-900 leading-relaxed">{q.question}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 pr-12">
                          {(q.options || []).map((opt: string, oIdx: number) => (
                            <button 
                              key={oIdx} 
                              onClick={() => setExamAnswers({ ...examAnswers, [qIdx]: oIdx })}
                              className={cn(
                                "group flex items-center gap-4 p-5 rounded-2xl text-right transition-all border-2",
                                examAnswers[qIdx] === oIdx 
                                  ? "bg-blue-50/50 border-[#005bbf] text-[#005bbf]" 
                                  : "bg-white border-transparent hover:bg-gray-50 text-gray-600"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                examAnswers[qIdx] === oIdx ? "border-[#005bbf] bg-[#005bbf]" : "border-gray-200"
                              )}>
                                {examAnswers[qIdx] === oIdx && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <span className="font-bold text-lg">{opt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ));
                  } else {
                    return (
                      <div className="py-20 text-center space-y-4">
                        <span className="material-symbols-outlined text-6xl text-gray-200">error</span>
                        <p className="text-gray-500 font-bold">عذراً، هذا الاختبار لا يحتوي على أسئلة حالياً.</p>
                        <Button onClick={() => setIsTakingExam(false)} variant="outline">العودة للخلف</Button>
                      </div>
                    );
                  }
                })()}
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
