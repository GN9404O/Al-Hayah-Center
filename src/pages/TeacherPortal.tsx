import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Teacher, Grade, Student, Group, Schedule, AppSettings } from '../types';
import { ACADEMIC_STAGES } from '../constants';
import { Button, Input, Card, Badge, cn } from '../components/ui';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Edit2, 
  Clock, 
  MapPin, 
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronLeft,
  GraduationCap,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

type Tab = 'dashboard' | 'exams' | 'students' | 'schedule' | 'profile';

export default function TeacherPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    subject: '',
    bio: '',
    experience: '',
    photoURL: '',
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      youtube: ''
    }
  });

  // Exams state
  const [exams, setExams] = useState<any[]>([]);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [currentExam, setCurrentExam] = useState<any>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    gradeId: '',
    date: '',
    duration: '',
    totalMarks: '',
    description: ''
  });

  useEffect(() => {
    if (!user) return;

    // Fetch teacher profile linked to this user
    const q = query(collection(db, 'teachers'), where('userId', '==', user.id));
    const unsubTeacher = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const teacherData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Teacher;
        setTeacher(teacherData);
        setProfileForm({
          name: teacherData.name,
          phone: teacherData.phone,
          subject: teacherData.subject,
          bio: teacherData.bio || '',
          experience: teacherData.experience || '',
          photoURL: teacherData.photoURL || '',
          socialLinks: {
            facebook: teacherData.socialLinks?.facebook || '',
            instagram: teacherData.socialLinks?.instagram || '',
            twitter: teacherData.socialLinks?.twitter || '',
            youtube: teacherData.socialLinks?.youtube || '',
          }
        });
      } else {
        setTeacher(null);
      }
      setLoading(false);
    });

    const unsubGrades = onSnapshot(collection(db, 'grades'), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) setSettings(doc.data() as AppSettings);
    });

    return () => {
      unsubTeacher();
      unsubGrades();
      unsubSettings();
    };
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;

    try {
      await updateDoc(doc(db, 'teachers', teacher.id), {
        ...profileForm,
        updatedAt: serverTimestamp(),
      });
      toast.success('تم تحديث الملف الشخصي بنجاح');
    } catch (e) {
      toast.error('حدث خطأ أثناء تحديث الملف');
    }
  };

  useEffect(() => {
    if (!teacher) return;

    // Fetch teacher's groups
    const unsubGroups = onSnapshot(
      query(collection(db, 'groups'), where('teacherId', '==', teacher.id)),
      (snapshot) => {
        setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
      }
    );

    // Fetch teacher's schedule
    const unsubSchedule = onSnapshot(
      query(collection(db, 'schedules'), where('teacherId', '==', teacher.id)),
      (snapshot) => {
        setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
      }
    );

    // Fetch teacher's exams
    const unsubExams = onSnapshot(
      query(collection(db, 'exams'), where('teacherId', '==', teacher.id), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubGroups();
      unsubSchedule();
      unsubExams();
    };
  }, [teacher]);

  // Fetch students for teacher's groups
  useEffect(() => {
    if (groups.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const groupIds = groups.map(g => g.id);
    // Firestore where in limit is 10, so if teacher has more than 10 groups, we might need multiple queries
    // For now assume < 10 or just fetch all students and filter in memory if needed
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(allStudents.filter(s => groupIds.includes(s.groupId)));
      setLoading(false);
    });

    return () => unsubStudents();
  }, [groups]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;

    try {
      if (currentExam) {
        await updateDoc(doc(db, 'exams', currentExam.id), {
          ...examForm,
          updatedAt: serverTimestamp(),
        });
        toast.success('تم تحديث الاختبار بنجاح');
      } else {
        await addDoc(collection(db, 'exams'), {
          ...examForm,
          teacherId: teacher.id,
          teacherName: teacher.name,
          subject: teacher.subject,
          createdAt: serverTimestamp(),
        });
        toast.success('تم إضافة الاختبار بنجاح');
      }
      setIsExamModalOpen(false);
      setExamForm({ title: '', gradeId: '', date: '', duration: '', totalMarks: '', description: '' });
      setCurrentExam(null);
    } catch (e) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const getGradeName = (gradeId: string) => {
    for (const stage of ACADEMIC_STAGES) {
      const g = stage.grades.find(g => g.id === gradeId);
      if (g) return g.name;
    }
    return grades.find(g => g.id === gradeId)?.name || 'غير محدد';
  };

  if (!teacher && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900">عذراً، لم يتم العثور على ملفك الشخصي</h2>
          <p className="text-gray-500 leading-relaxed">
            يرجى التواصل مع إدارة المركز لربط حسابك بملف المعلم الخاص بك لتتمكن من الوصول للوحة التحكم.
          </p>
          <Button onClick={() => logout()} variant="outline" className="w-full h-12 rounded-xl gap-2 font-bold">
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex rtl" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l border-gray-100 hidden lg:flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">
              {settings?.systemName?.charAt(0) || 'E'}
            </div>
            <h1 className="font-black text-xl text-gray-900">{settings?.systemName || 'إديو سنتر'}</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all group",
              activeTab === 'dashboard' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50 hover:text-blue-600"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>الرئيسية</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all group",
              activeTab === 'students' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50 hover:text-blue-600"
            )}
          >
            <Users className="w-5 h-5" />
            <span>طلابي</span>
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all group",
              activeTab === 'exams' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50 hover:text-blue-600"
            )}
          >
            <FileText className="w-5 h-5" />
            <span>الاختبارات</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all group",
              activeTab === 'schedule' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50 hover:text-blue-600"
            )}
          >
            <Calendar className="w-5 h-5" />
            <span>جدولي</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all group",
              activeTab === 'profile' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50 hover:text-blue-600"
            )}
          >
            <Settings className="w-5 h-5" />
            <span>الملف الشخصي</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-50 mb-6">
          <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center overflow-hidden">
                {teacher?.photoURL ? (
                  <img src={teacher.photoURL} alt={teacher.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-blue-600 font-bold">{teacher?.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{teacher?.name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{teacher?.subject}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-red-500 hover:bg-red-50 font-bold text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto custom-scrollbar">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">
              {settings?.systemName?.charAt(0) || 'E'}
            </div>
            <h1 className="font-black text-xl text-gray-900">{settings?.systemName || 'إديو سنتر'}</h1>
          </div>
          <button onClick={() => logout()} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="w-6 h-6" />
          </button>
        </header>

        <div className="p-8 space-y-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">أهلاً بك، مستر {teacher?.name.split(' ')[0]} 👋</h2>
                  <p className="text-gray-500 mt-1">إليك نظرة سريعة على فصولك الدراسية اليوم</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 space-y-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{students.length}</p>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">إجمالي طلابك</p>
                  </div>
                </Card>
                <Card className="p-6 space-y-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{groups.length}</p>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">المجموعات الدراسية</p>
                  </div>
                </Card>
                <Card className="p-6 space-y-4">
                  <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{exams.length}</p>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">الاختبارات المضافة</p>
                  </div>
                </Card>
                <Card className="p-6 space-y-4">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{schedules.length}</p>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">حصص الجدول</p>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-8 space-y-6">
                  <h3 className="text-xl font-black text-gray-900 flex items-center gap-4">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    جدول اليوم
                  </h3>
                  <div className="space-y-4">
                    {schedules.length === 0 ? (
                      <p className="text-gray-400 text-center py-10">لا يوجد حصص اليوم</p>
                    ) : (
                      schedules.slice(0, 5).map((session, idx) => (
                        <div key={idx} className="flex items-center gap-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all group">
                          <div className="w-16 h-16 bg-white rounded-xl flex flex-col items-center justify-center font-bold text-blue-600 shadow-sm border border-gray-50">
                            <Clock className="w-5 h-5 mb-1" />
                            <span className="text-[10px]">{session.startTime}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-gray-900">{getGradeName(session.gradeId)}</p>
                            <p className="text-xs text-gray-500">{groups.find(g => g.id === session.groupId)?.name || 'مجموعة دراسية'}</p>
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">قاعة {session.room}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="p-8 space-y-6">
                  <h3 className="text-xl font-black text-gray-900 flex items-center gap-4">
                    <Users className="w-6 h-6 text-purple-600" />
                    طلابك الجدد
                  </h3>
                  <div className="space-y-4">
                    {students.length === 0 ? (
                      <p className="text-gray-400 text-center py-10">لا يوجد طلاب مسجلون بعد</p>
                    ) : (
                      students.slice(0, 5).map((student, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                            {student.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{student.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{getGradeName(student.gradeId)}</p>
                          </div>
                          <Badge variant="success" className="text-[10px]">نشط</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">طلابي</h2>
                  <p className="text-gray-500">قائمة بجميع الطلاب المسجلين في فصولك</p>
                </div>
              </div>

              {/* Grouped by Grade */}
              <div className="space-y-8">
                {teacher?.gradeIds.map(gradeId => {
                  const gradeStudents = students.filter(s => s.gradeId === gradeId);
                  if (gradeStudents.length === 0) return null;
                  
                  return (
                    <div key={gradeId} className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-gray-100" />
                        <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em]">{getGradeName(gradeId)}</h3>
                        <div className="h-px flex-1 bg-gray-100" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {gradeStudents.map(student => (
                          <Card key={student.id} className="p-6 hover:border-blue-200 transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <Users className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 truncate">{student.name}</p>
                                <p className="text-xs text-gray-400">{groups.find(g => g.id === student.groupId)?.name || 'مجموعة دراسية'}</p>
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                              <div className="flex gap-2">
                                <button className="p-2 text-gray-400 hover:text-green-600 transition-colors">
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                  <FileText className="w-4 h-4" />
                                </button>
                              </div>
                              <Badge variant="default" className="text-[10px] font-bold">الحالة: منتظم</Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {students.length === 0 && (
                  <div className="py-20 text-center">
                    <AlertCircle className="mx-auto w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-bold">لا يوجد طلاب مسجلون بعد في مجموعاتك</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">الاختبارات</h2>
                  <p className="text-gray-500">إدارة مراجعاتك واختباراتك الدورية</p>
                </div>
                <Button onClick={() => {
                  setCurrentExam(null);
                  setExamForm({ title: '', gradeId: '', date: '', duration: '', totalMarks: '', description: '' });
                  setIsExamModalOpen(true);
                }} className="gap-2 rounded-xl h-12 font-bold px-6">
                  <Plus className="w-5 h-5" />
                  إضافة اختبار
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map(exam => (
                  <Card key={exam.id} className="p-6 flex flex-col h-full border-b-4 border-b-blue-600">
                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-blue-50 text-blue-600 rounded-lg">{getGradeName(exam.gradeId)}</Badge>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => {
                              setCurrentExam(exam);
                              setExamForm({
                                title: exam.title,
                                gradeId: exam.gradeId,
                                date: exam.date,
                                duration: exam.duration,
                                totalMarks: exam.totalMarks,
                                description: exam.description || ''
                              });
                              setIsExamModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('هل أنت متأكد من حذف هذا الاختبار؟')) {
                                await deleteDoc(doc(db, 'exams', exam.id));
                                toast.success('تم حذف الاختبار');
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-gray-900 leading-tight">{exam.title}</h4>
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{exam.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                          <Clock className="w-4 h-4" />
                          {exam.duration} دقيقة
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                          <AlertCircle className="w-4 h-4" />
                          {exam.totalMarks} درجة
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">بتاريخ: {exam.date}</span>
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50 gap-1 rounded-lg">
                        <span>النتائج</span>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
                
                {exams.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                    <FileText className="mx-auto w-16 h-16 text-gray-200" />
                    <p className="text-gray-400 font-bold mt-4">لا يوجد اختبارات مضافة حالياً</p>
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsExamModalOpen(true)}
                      className="text-blue-600 mt-4 font-bold"
                    >
                      ابدأ بإضافة أول اختبار
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">جدولي الدراسي</h2>
                  <p className="text-gray-500">مواعيد حصصك الأسبوعية في المركز</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                  const daySchedules = schedules.filter(s => s.day === day);
                  
                  return (
                    <div key={day} className="space-y-4">
                      <div className="p-3 bg-white border border-gray-100 rounded-xl text-center shadow-sm">
                        <span className="font-black text-gray-900">
                          {day === 'Saturday' ? 'السبت' :
                           day === 'Sunday' ? 'الأحد' :
                           day === 'Monday' ? 'الإثنين' :
                           day === 'Tuesday' ? 'الثلاثاء' :
                           day === 'Wednesday' ? 'الأربعاء' :
                           day === 'Thursday' ? 'الخميس' : 'الجمعة'}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {daySchedules.length === 0 ? (
                          <div className="py-8 text-center text-[10px] font-bold text-gray-300 italic">لا يوجد حصص</div>
                        ) : (
                          daySchedules.map((session, idx) => (
                            <div key={idx} className="p-3 bg-blue-50 border border-blue-100 rounded-xl relative group overflow-hidden">
                              <div className="absolute top-0 right-0 w-1 h-full bg-blue-600" />
                              <p className="font-black text-blue-900 text-xs break-words">{getGradeName(session.gradeId)}</p>
                              <p className="text-[10px] text-blue-600 mt-1 font-bold">{session.startTime}</p>
                              <div className="mt-2 flex items-center gap-1 text-[9px] text-blue-400 font-bold uppercase tracking-wider">
                                <MapPin className="w-2.5 h-2.5" />
                                <span>قاعة {session.room}</span>
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

          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">الملف الشخصي</h2>
                  <p className="text-gray-500">إدارة معلوماتك المهنية التي تظهر للطلاب</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <Card className="p-8">
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div className="w-32 h-32 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 text-4xl font-bold overflow-hidden shadow-inner flex-shrink-0 border-4 border-white">
                        {profileForm.photoURL ? (
                          <img src={profileForm.photoURL} alt={profileForm.name} className="w-full h-full object-cover" />
                        ) : (
                          profileForm.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 space-y-4 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            label="الاسم الكامل"
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            required
                          />
                          <Input
                            label="رقم الهاتف"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            label="المادة الدراسية"
                            value={profileForm.subject}
                            onChange={(e) => setProfileForm({ ...profileForm, subject: e.target.value })}
                            required
                          />
                          <Input
                            label="الخبرة"
                            value={profileForm.experience}
                            onChange={(e) => setProfileForm({ ...profileForm, experience: e.target.value })}
                          />
                        </div>
                        <Input
                          label="رابط الصورة (ImgBB)"
                          placeholder="https://i.ibb.co/..."
                          value={profileForm.photoURL}
                          onChange={(e) => setProfileForm({ ...profileForm, photoURL: e.target.value })}
                          icon={<ImageIcon className="w-4 h-4" />}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                       <h3 className="font-bold text-gray-900 text-lg border-b pb-2">عنك (النبذة التعريفية)</h3>
                       <textarea
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[150px] transition-all bg-gray-50/30"
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        placeholder="أخبر الطلاب أكثر عن مهاراتك وطريقة تدريسك..."
                       />
                    </div>

                    <div className="space-y-4 pt-4">
                      <h3 className="font-bold text-gray-900 text-lg border-b pb-2">روابط التواصل الاجتماعي</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="فيسبوك"
                          value={profileForm.socialLinks.facebook}
                          onChange={(e) => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, facebook: e.target.value } })}
                        />
                        <Input
                          label="إنستجرام"
                          value={profileForm.socialLinks.instagram}
                          onChange={(e) => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, instagram: e.target.value } })}
                        />
                        <Input
                          label="تويتر"
                          value={profileForm.socialLinks.twitter}
                          onChange={(e) => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, twitter: e.target.value } })}
                        />
                        <Input
                          label="يوتيوب"
                          value={profileForm.socialLinks.youtube}
                          onChange={(e) => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, youtube: e.target.value } })}
                        />
                      </div>
                    </div>

                    <div className="pt-6 flex justify-end">
                      <Button type="submit" className="px-10 h-14 rounded-2xl font-black text-lg shadow-lg shadow-blue-200">
                        حفظ التغييرات
                      </Button>
                    </div>
                  </div>
                </Card>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Exam Modal */}
      <Modal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        title={currentExam ? 'تعديل اختبار' : 'إضافة اختبار جديد'}
        size="lg"
      >
        <form onSubmit={handleCreateExam} className="space-y-4">
          <Input
            label="عنوان الاختبار"
            placeholder="مثال: اختبار الكيمياء الشهري - الباب الأول"
            value={examForm.title}
            onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700">الصف الدراسي</label>
              <select
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all bg-white"
                value={examForm.gradeId}
                onChange={(e) => setExamForm({ ...examForm, gradeId: e.target.value })}
                required
              >
                <option value="">اختر الصف</option>
                {teacher?.gradeIds.map(gradeId => (
                  <option key={gradeId} value={gradeId}>{getGradeName(gradeId)}</option>
                ))}
              </select>
            </div>
            <Input
              label="تاريخ الاختبار"
              type="date"
              value={examForm.date}
              onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="المدة (بالدقائق)"
              type="number"
              value={examForm.duration}
              onChange={(e) => setExamForm({ ...examForm, duration: e.target.value })}
              required
            />
            <Input
              label="الدرجة القصوى"
              type="number"
              value={examForm.totalMarks}
              onChange={(e) => setExamForm({ ...examForm, totalMarks: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-700">وصف الاختبار (اختياري)</label>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all min-h-[100px]"
              value={examForm.description}
              onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
              placeholder="اكتب ملاحظات إضافية عن الاختبار..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 h-12 rounded-xl font-bold">
              {currentExam ? 'تحديث' : 'إضافة'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsExamModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold">
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
