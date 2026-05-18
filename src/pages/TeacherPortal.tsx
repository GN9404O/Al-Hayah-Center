import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Teacher, Grade, Student, Group, Schedule, AppSettings } from '../types';
import { ACADEMIC_STAGES } from '../constants';
import { Button, Input, Card, Badge, cn } from '../components/ui';
import { MathJax } from "better-react-mathjax";

import { 
  Users, 
  BookOpen, 
  Calendar, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit2, 
  Clock, 
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronLeft,
  X,
  User,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

type Tab = 'home' | 'exams' | 'students' | 'profile';

const TeacherPortal = () => {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    notes: '',
    gradeIds: [] as string[],
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
  const [isExamEditorActive, setIsExamEditorActive] = useState(false);
  const [currentExam, setCurrentExam] = useState<any>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    gradeId: '',
    date: '',
    duration: '',
    totalMarks: '',
    description: '',
    accessCode: '',
    questions: [] as any[],
  });
  const [jsonPrompt, setJsonPrompt] = useState('');
  const [manualQuestion, setManualQuestion] = useState({
    question: '',
    image: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    marks: 5
  });

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'teachers'), where('userId', '==', user.id));
    const unsubTeacher = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const teacherData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Teacher;
        setTeacher(teacherData);
        setProfileForm({
          name: teacherData.name,
          email: teacherData.email || '',
          phone: teacherData.phone,
          subject: teacherData.subject,
          notes: teacherData.notes || '',
          gradeIds: teacherData.gradeIds || [],
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
      }
      setLoading(false);
    });

    onSnapshot(collection(db, 'grades'), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    return () => unsubTeacher();
  }, [user]);

  useEffect(() => {
    if (!teacher) return;

    const unsubGroups = onSnapshot(
      query(collection(db, 'groups'), where('teacherId', '==', teacher.id)),
      (snapshot) => setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)))
    );

    const unsubSchedule = onSnapshot(
      query(collection(db, 'schedules'), where('teacherId', '==', teacher.id)),
      (snapshot) => setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)))
    );

    const unsubExams = onSnapshot(
      query(collection(db, 'exams'), where('teacherId', '==', teacher.id), orderBy('createdAt', 'desc')),
      (snapshot) => setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'exams')
    );

    return () => {
      unsubGroups();
      unsubSchedule();
      unsubExams();
    };
  }, [teacher]);

  useEffect(() => {
    if (groups.length === 0) return;
    const groupIds = groups.map(g => g.id);
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(allStudents.filter(s => groupIds.includes(s.groupId)));
    });
    return () => unsubStudents();
  }, [groups]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;
    try {
      await updateDoc(doc(db, 'teachers', teacher.id), { ...profileForm, updatedAt: serverTimestamp() });
      toast.success('تم تحديث الملف الشخصي بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء التحديث');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;
    try {
      let finalQuestions = [...(examForm.questions || [])];

      // Auto-import if prompt is filled but questions are empty
      if (finalQuestions.length === 0 && jsonPrompt.trim()) {
        try {
          let parsed;
          try {
            parsed = JSON.parse(jsonPrompt);
          } catch (e) {
            // Try to fix common JSON errors (like missing quotes or wrong quotes) if possible, or just re-throw
            throw new Error('تنسيق الـ JSON غير صحيح. تأكد من استخدام علامات الاقتباس المزدوجة " وليس المفردة \'.');
          }

          // Support both array and object with questions key
          const items = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.qs || []);
          
          if (!Array.isArray(items) || items.length === 0) {
            throw new Error('لم يتم العثور على مصفوفة أسئلة في الـ JSON المدخل.');
          }

          finalQuestions = items.map((item: any) => ({
            question: item.q || item.question || '',
            image: item.i || item.img || item.image || null,
            options: Array.isArray(item.o || item.options || item.a) ? (item.o || item.options || item.a) : [],
            correctAnswer: typeof item.c !== 'undefined' ? Number(item.c) : (typeof item.correctAnswer !== 'undefined' ? Number(item.correctAnswer) : 0),
            marks: Number(item.m || item.marks || (Math.round((Number(examForm.totalMarks) / items.length) * 10) / 10 || 0))
          }));
        } catch (err: any) {
          toast.error(`حدث خطأ أثناء قراءة الـ JSON تلقائياً: ${err.message}`);
          return; // Stop saving if auto-parse was intended but failed
        }
      }

      if (finalQuestions.length === 0) {
        toast.error('عذراً، يجب إضافة أسئلة للاختبار أولاً عن طريق استيراد JSON أو إدخالها يدوياً');
        return;
      }

      const examData = {
        title: examForm.title || '',
        gradeId: examForm.gradeId || '',
        date: examForm.date || '',
        duration: examForm.duration || '',
        totalMarks: examForm.totalMarks || '',
        description: examForm.description || '',
        accessCode: examForm.accessCode || '',
        questions: finalQuestions,
        teacherId: teacher.id,
        teacherName: teacher.name || 'معلم',
        subject: teacher.subject || 'مادة',
      };

      if (currentExam) {
        await updateDoc(doc(db, 'exams', currentExam.id), { ...examData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'exams'), { ...examData, createdAt: serverTimestamp() });
      }
      setIsExamEditorActive(false);
      setExamForm({ title: '', gradeId: '', date: '', duration: '', totalMarks: '', description: '', accessCode: '', questions: [] });
      setJsonPrompt('');
      setCurrentExam(null);
      toast.success('تم الحفظ بنجاح');
    } catch (error) {
      handleFirestoreError(error, currentExam ? OperationType.UPDATE : OperationType.CREATE, 'exams');
    }
  };

  const toggleGrade = (gradeId: string) => {
    setProfileForm(prev => ({
      ...prev,
      gradeIds: prev.gradeIds.includes(gradeId)
        ? prev.gradeIds.filter(id => id !== gradeId)
        : [...prev.gradeIds, gradeId]
    }));
  };

  const getGradeName = (gradeId: string) => {
    for (const stage of ACADEMIC_STAGES) {
      const g = stage.grades.find(g => g.id === gradeId);
      if (g) return g.name;
    }
    return grades.find(g => g.id === gradeId)?.name || 'غير محدد';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]"><div className="w-12 h-12 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#f7f9ff] font-sans rtl text-right flex flex-col lg:flex-row" dir="rtl">
      {isExamEditorActive ? (
        <div className="flex-1 bg-[#f8fafc] min-h-screen overflow-y-auto">
          {/* Full Screen Header */}
          <header className="h-20 bg-white border-b border-gray-100 sticky top-0 z-[60] px-6 md:px-10 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-5">
              <button 
                onClick={() => setIsExamEditorActive(false)}
                className="w-12 h-12 rounded-2xl hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-all border border-transparent hover:border-red-100"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
              <div className="h-10 w-[2px] bg-gray-100 mx-2" />
              <div>
                <h2 className="text-xl font-black text-gray-900 leading-none">
                  {currentExam ? 'تعديل الاختبار' : 'إضافة اختبار جديد'}
                </h2>
                <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                   بيئة العمل الذكية
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
               <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsExamEditorActive(false)}
                className="h-12 px-8 rounded-xl font-black border-2 border-gray-100 text-gray-400 hover:bg-gray-50"
               >
                 إلغاء التغييرات
               </Button>
               <Button 
                onClick={handleCreateExam}
                className="h-12 px-10 rounded-xl font-black shadow-xl shadow-blue-200 bg-[#005bbf] hover:bg-blue-700"
               >
                 {currentExam ? 'تحديث الاختبار' : 'نشر الاختبار الآن'}
               </Button>
            </div>
          </header>

          <main className="max-w-5xl mx-auto py-16 px-6 pb-32">
            <div className="space-y-12">
               {/* 1. Base Info */}
               <Card className="p-10 rounded-[3rem] border-none shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] bg-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-4 border-r-4 border-blue-600 pr-6">
                      <h3 className="text-2xl font-black text-gray-900">المعلومات الأساسية</h3>
                    </div>
                    
                    <Input 
                      label="عنوان الاختبار الفني" 
                      value={examForm.title} 
                      onChange={e => setExamForm({ ...examForm, title: e.target.value })} 
                      className="h-16 rounded-2xl text-lg font-bold border-gray-100 bg-gray-50/50"
                      required 
                      placeholder="مثال: مراجعة الوحدة الأولى كيمياء" 
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-1">
                          <label className="text-xs font-black text-gray-400 mr-6 mb-2 block uppercase tracking-widest">الصف الدراسي المستهدف</label>
                          <select className="w-full h-16 bg-gray-50/50 rounded-2xl border border-gray-100 focus:ring-4 focus:ring-blue-100 font-bold px-8 text-gray-700 appearance-none transition-all" value={examForm.gradeId} onChange={e => setExamForm({ ...examForm, gradeId: e.target.value })} required>
                              <option value="">اختر الصف من القائمة...</option>
                              {teacher?.gradeIds.map(gid => (
                                <option key={gid} value={gid}>{getGradeName(gid)}</option>
                              ))}
                          </select>
                      </div>
                      <Input label="موعد الاختبار" type="date" value={examForm.date} onChange={e => setExamForm({ ...examForm, date: e.target.value })} className="h-16 rounded-2xl font-bold bg-gray-50/50 border-gray-100" required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <Input label="زمن الاختبار (ق)" type="number" value={examForm.duration} onChange={e => setExamForm({ ...examForm, duration: e.target.value })} className="h-16 rounded-2xl font-bold bg-gray-50/50 border-gray-100" required />
                      <Input label="الدرجة الكلية" type="number" value={examForm.totalMarks} onChange={e => {
                          const val = e.target.value;
                          setExamForm(prev => {
                            const newTotal = Number(val);
                            const qCount = prev.questions.length;
                            if (qCount > 0) {
                              const marksPerQ = Math.round((newTotal / qCount) * 10) / 10;
                              return { ...prev, totalMarks: val, questions: prev.questions.map(q => ({ ...q, marks: marksPerQ })) };
                            }
                            return { ...prev, totalMarks: val };
                          });
                      }} className="h-16 rounded-2xl font-bold bg-gray-50/50 border-gray-100" required />
                      <Input label="رمز دخول الاختبار" value={examForm.accessCode} onChange={e => setExamForm({ ...examForm, accessCode: e.target.value })} className="h-16 rounded-2xl font-bold bg-gray-50/50 border-gray-100" required placeholder="CHEM2026" />
                    </div>
                  </div>
               </Card>

               {/* 2. AI Importer */}
               <Card className="p-10 rounded-[3rem] border-none shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] bg-white space-y-8">
                  <div className="flex items-center justify-between border-r-4 border-blue-600 pr-6">
                    <h3 className="text-2xl font-black text-gray-900">توليد الأسئلة بالذكاء الاصطناعي</h3>
                  </div>

                  <div className="bg-[#0f172a] p-10 rounded-[3rem] font-mono text-[11px] leading-relaxed relative overflow-hidden group border border-gray-800 shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                        <span className="text-gray-400 uppercase tracking-widest font-black text-xs">AI Workspace Control</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 rounded-full text-blue-400 border border-blue-500/20 text-[10px] font-black">
                         SYSTEM STATUS: READY
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <Button 
                          type="button" 
                          className="flex-1 h-14 rounded-2xl bg-[#3b82f6] hover:bg-blue-600 text-white font-black flex items-center justify-center gap-3 shadow-xl shadow-blue-900/30 transition-all active:scale-95"
                          onClick={() => {
                              const instructions = `سأرسل لك صورة لاختبار أو مجموعة أسئلة. وظيفتك هي تحويلها إلى ملف JSON بدقة عالية جداً.
الأساسيات:
1. استخرج الأسئلة والخيارات الأربعة لكل سؤال.
2. استخدم لغة LaTeX لكافة المعادلات، الرموز، الكسور، والجذور.
3. هام جداً: لا تضع نصاً عربياً داخل علامات الدولار $$. ضع النص العربي قبلها أو بعدها.
4. هام جداً: استخدم علامة الدولار المزدوجة $$ قبل وبعد أي كسر أو رمز رياضي ليظهر بشكل عمودي منسق واحترافي.
5. المواد العلمية (فيزياء، أحياء..): إذا وجد رسم أو رمز معقد، ضعه في حقل "i" كرابط صورة (مثلاً من imgbb).
6. التنسيق هو JSON ARRAY (قائمة).
7. حدد رقم الإجابة الصحيحة في الحقل "c" (0 للأول، 1 للثاني...).
8. ضع الدرجة الافتراضية 5 في "m".

مثال للتنسيق المطلوب:
[
  {
    "q": "أوجد قيمة النهاية: $$ \\lim_{x \\to 2} \\frac{x^2 - 6x}{x^2+x-12} $$",
    "o": ["$$ \\frac{5}{7} $$", "$$ \\frac{1}{7} $$", "-1", "-5"],
    "c": 0,
    "m": 5,
    "i": "https://i.ibb.co/..."
  }
]`;
                              navigator.clipboard.writeText(instructions);
                              toast.success('تم نسخ التعليمات.. أرسلها الآن للـ AI مع صورة الامتحان');
                          }}
                        >
                          <span className="material-symbols-outlined text-2xl">content_copy</span>
                          نسخ "تعليمات الـ AI"
                        </Button>
                      </div>

                      <div className="relative">
                        <textarea 
                          value={jsonPrompt} 
                          onChange={e => setJsonPrompt(e.target.value)}
                          placeholder='ألصق كود الـ JSON هنا للبدء بالبناء الفوري...'
                          className="w-full h-80 bg-black/40 rounded-[2.5rem] border border-white/5 font-mono text-sm p-10 text-blue-300 placeholder:text-gray-700 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none"
                        />
                        <div className="absolute bottom-6 left-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                           Paste standard JSON array
                        </div>
                      </div>

                      <Button 
                        type="button" 
                        onClick={() => {
                          try {
                            let parsed;
                            try {
                              parsed = JSON.parse(jsonPrompt);
                            } catch (e) {
                              throw new Error('تنسيق الـ JSON غير صحيح. تأكد من استخدام علامات الاقتباس المزدوجة " وليس المفردة \'.');
                            }

                            const items = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.qs || []);
                            
                            if (!Array.isArray(items) || items.length === 0) {
                              throw new Error('لم يتم العثور على مصفوفة أسئلة في الـ JSON المدخل.');
                            }

                            const normalized = items.map((item: any) => {
                                let imageUrl = item.i || item.img || item.image || null;
                                if (imageUrl && typeof imageUrl === 'string') {
                                    // 1. Try to extract from [img]...[/img] (BBCode)
                                    const bbMatch = imageUrl.match(/\[img\]\s*(https?:\/\/[^\]\s]+)\s*\[\/img\]/i);
                                    // 2. Try to extract from Markdown (url) or general URL
                                    const rawMatch = imageUrl.match(/(https?:\/\/[^\s\]\)"']+)/);
                                    
                                    if (bbMatch && bbMatch[1]) {
                                        imageUrl = bbMatch[1].trim();
                                    } else if (rawMatch && rawMatch[1]) {
                                        imageUrl = rawMatch[1].trim();
                                    }
                                }
                                return {
                                    question: item.q || item.question || '',
                                    image: imageUrl,
                                    options: Array.isArray(item.o || item.options || item.a) ? (item.o || item.options || item.a) : [],
                                    correctAnswer: typeof item.c !== 'undefined' ? Number(item.c) : (typeof item.correctAnswer !== 'undefined' ? Number(item.correctAnswer) : 0),
                                    marks: Number(item.m || item.marks || (Math.round((Number(examForm.totalMarks) / items.length) * 10) / 10 || 0))
                                };
                            });

                            setExamForm(prev => ({ ...prev, questions: normalized }));
                            toast.success(`تم بنجاح! تم استيراد ${normalized.length} سؤال.`);
                          } catch (err: any) {
                            toast.error('خطأ في استيراد البيانات: ' + err.message);
                          }
                        }}
                        className="w-full h-18 rounded-[1.75rem] bg-white text-[#0f172a] hover:bg-gray-100 font-black text-xl flex items-center justify-center gap-4 transition-all shadow-2xl group"
                      >
                        <span className="material-symbols-outlined text-3xl group-hover:rotate-180 transition-transform duration-700">automation</span>
                        بناء قائمة الأسئلة فوراً
                      </Button>
                    </div>

                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full -mr-40 -mt-40 blur-[100px] pointer-events-none" />
                  </div>
               </Card>

               {/* 3. Manual Question Adder */}
               <Card className="p-10 rounded-[3rem] border-none shadow-[0_20px_50px_-20_rgba(0,0,0,0.05)] bg-white space-y-8">
                  <div className="flex items-center gap-4 border-r-4 border-emerald-600 pr-6">
                    <h3 className="text-2xl font-black text-gray-900">إضافة سؤال يدوياً</h3>
                  </div>

                  <div className="space-y-6">
                    <Input 
                      label="نص السؤال (يدعم LaTeX)" 
                      value={manualQuestion.question} 
                      onChange={e => setManualQuestion({ ...manualQuestion, question: e.target.value })}
                      placeholder="اكتب السؤال هنا... استخدم $$ للرموز الرياضية"
                      className="rounded-2xl border-gray-100 bg-gray-50/50"
                    />
                    
                    <Input 
                      label="رابط صورة السؤال (اختياري)" 
                      value={manualQuestion.image} 
                      onChange={e => setManualQuestion({ ...manualQuestion, image: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      className="rounded-2xl border-gray-100 bg-gray-50/50"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {manualQuestion.options.map((opt, i) => (
                        <div key={i} className="relative group">
                          <Input 
                            label={`الخيار ${i + 1}`} 
                            value={opt} 
                            onChange={e => {
                              const newOpts = [...manualQuestion.options];
                              newOpts[i] = e.target.value;
                              setManualQuestion({ ...manualQuestion, options: newOpts });
                            }}
                            placeholder={`اكتب الخيار ${i + 1} هنا...`}
                            className={cn(
                              "rounded-2xl border-gray-100 bg-gray-50/50 pl-14",
                              manualQuestion.correctAnswer === i && "border-emerald-200 bg-emerald-50/30"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setManualQuestion({ ...manualQuestion, correctAnswer: i })}
                            className={cn(
                              "absolute bottom-4 left-4 w-8 h-8 rounded-xl border flex items-center justify-center transition-all",
                              manualQuestion.correctAnswer === i 
                                ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200" 
                                : "border-gray-200 text-gray-300 hover:border-emerald-300 hover:text-emerald-500"
                            )}
                          >
                            <span className="material-symbols-outlined text-lg font-bold">check</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4 items-center flex-col sm:flex-row">
                      <div className="flex-1 w-full">
                        <Input 
                          label="درجة السؤال" 
                          type="number" 
                          value={manualQuestion.marks} 
                          onChange={e => setManualQuestion({ ...manualQuestion, marks: Number(e.target.value) })}
                          className="rounded-2xl border-gray-100 bg-gray-50/50"
                        />
                      </div>
                      <div className="flex-1 w-full pt-6">
                        <Button
                          type="button"
                          onClick={() => {
                            if (!manualQuestion.question && !manualQuestion.image) {
                              toast.error('يرجى إدخال نص السؤال أو صورة');
                              return;
                            }
                            if (manualQuestion.options.some(opt => !opt.trim())) {
                              toast.error('يرجى ملء جميع الخيارات الأربعة');
                              return;
                            }
                            setExamForm(prev => {
                            let imageUrl = manualQuestion.image;
                            if (imageUrl && typeof imageUrl === 'string') {
                                // 1. Try to extract from [img]...[/img] (BBCode)
                                const bbMatch = imageUrl.match(/\[img\]\s*(https?:\/\/[^\]\s]+)\s*\[\/img\]/i);
                                // 2. Try to find any direct URL
                                const rawMatch = imageUrl.match(/(https?:\/\/[^\s\]\)"']+)/);
                                
                                if (bbMatch && bbMatch[1]) {
                                    imageUrl = bbMatch[1].trim();
                                } else if (rawMatch && rawMatch[1]) {
                                    imageUrl = rawMatch[1].trim();
                                }
                            }
                            const newQuestions = [...prev.questions, { ...manualQuestion, image: imageUrl }];
                                return { ...prev, questions: newQuestions };
                            });
                            setManualQuestion({
                              question: '',
                              image: '',
                              options: ['', '', '', ''],
                              correctAnswer: 0,
                              marks: 5
                            });
                            toast.success('تم إضافة السؤال للقائمة');
                          }}
                          className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-200"
                        >
                          <span className="material-symbols-outlined">add_circle</span>
                          حفظ وإضافة للسؤال القادم
                        </Button>
                      </div>
                    </div>
                  </div>
               </Card>

               {/* 4. Questions List */}
               {examForm.questions.length > 0 && (
                 <div className="space-y-8">
                    <div className="flex items-center justify-between px-10">
                      <h3 className="text-2xl font-black text-gray-900 flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#005bbf] rounded-xl flex items-center justify-center text-white">
                          <span className="material-symbols-outlined font-black">fact_check</span>
                        </div>
                        مراجعة الأسئلة ({examForm.questions.length})
                      </h3>
                      <button 
                        type="button"
                        onClick={() => setExamForm(prev => ({ ...prev, questions: [] }))}
                        className="text-red-500 font-black text-sm flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
                      >
                         <span className="material-symbols-outlined text-lg">delete_sweep</span>
                         مسح كافة الأسئلة
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-10">
                       {examForm.questions.map((q, idx) => (
                         <div key={idx} className="bg-white p-10 rounded-[3.5rem] shadow-[0_15px_60px_-20px_rgba(0,0,0,0.06)] border border-gray-50 space-y-8 hover:shadow-2xl transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-2 h-full bg-[#005bbf] opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="flex flex-col md:flex-row items-start justify-between gap-8">
                               <div className="flex items-start gap-8 flex-1">
                                  <div className="w-14 h-14 rounded-[1.5rem] bg-gray-900 text-white flex items-center justify-center font-black text-2xl shrink-0 mt-1 shadow-xl">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 space-y-6 min-w-0">
                                     {q.image && (
                                       <div className="rounded-[2.5rem] overflow-hidden border-4 border-gray-50 max-w-lg bg-white shadow-inner relative group">
                                          <img 
                                            src={q.image} 
                                            alt="Question" 
                                            className="w-full h-auto object-contain max-h-[350px]" 
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.onerror = null;
                                              target.src = 'https://placehold.co/600x400?text=Error+Loading+Image';
                                            }}
                                          />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <a href={q.image} target="_blank" rel="noreferrer" className="bg-white text-black px-4 py-2 rounded-full font-bold text-xs">
                                              فتح الصورة الأصلية
                                            </a>
                                          </div>
                                       </div>
                                     )}
                                     <div className="text-2xl font-bold text-gray-900 leading-relaxed break-words">
                                        <span className="math-wrapper">
                                          <MathJax dynamic>{q.question}</MathJax>
                                        </span>
                                     </div>
                                  </div>
                               </div>
                               
                               <div className="flex items-center gap-3 shrink-0 self-end md:self-start">
                                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center">
                                     <span className="text-[9px] font-black text-gray-400 uppercase mb-1">الدرجة</span>
                                     <input 
                                        type="number" 
                                        value={q.marks} 
                                        onChange={e => {
                                          const newMarks = Number(e.target.value);
                                          const updated = [...examForm.questions];
                                          updated[idx] = { ...updated[idx], marks: newMarks };
                                          setExamForm({ ...examForm, questions: updated });
                                        }}
                                        className="w-12 bg-transparent border-none text-center font-black text-xl text-blue-600 focus:ring-0 p-0"
                                     />
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const updated = examForm.questions.filter((_, i) => i !== idx);
                                      setExamForm({ ...examForm, questions: updated });
                                    }}
                                    className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100"
                                  >
                                    <span className="material-symbols-outlined text-2xl">delete</span>
                                  </button>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mr-22">
                               {(q.options || []).map((opt: string, oIdx: number) => (
                                 <div 
                                    key={oIdx}
                                    className={cn(
                                       "p-6 rounded-2xl border-2 font-bold transition-all flex items-center gap-5 cursor-pointer",
                                       q.correctAnswer === oIdx 
                                          ? "bg-blue-50 border-blue-600 text-[#005bbf] shadow-lg shadow-blue-100" 
                                          : "bg-white border-gray-50 text-gray-400 hover:border-gray-200"
                                    )}
                                    onClick={() => {
                                      const updated = [...examForm.questions];
                                      updated[idx] = { ...updated[idx], correctAnswer: oIdx };
                                      setExamForm({ ...examForm, questions: updated });
                                    }}
                                 >
                                    <div className={cn(
                                       "w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-transform group-active:scale-90",
                                       q.correctAnswer === oIdx ? "border-[#005bbf] bg-[#005bbf]" : "border-gray-100"
                                    )}>
                                       {q.correctAnswer === oIdx && <span className="material-symbols-outlined text-white text-lg">check</span>}
                                    </div>
                                    <span className="math-wrapper text-lg">
                                      <MathJax dynamic>{opt}</MathJax>
                                    </span>
                                 </div>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="pt-20">
                       <Button 
                         onClick={handleCreateExam}
                         className="w-full h-24 rounded-[3rem] font-black text-3xl shadow-[0_30px_60px_-20px_rgba(0,91,191,0.3)] bg-[#005bbf] transition-all hover:scale-[1.02] active:scale-95"
                       >
                         {currentExam ? 'تحديث وتعديل الاختبار' : 'اعتماد ونشر الاختبار النهائي'}
                       </Button>
                    </div>
                 </div>
               )}
            </div>
          </main>
        </div>
      ) : (
        <>
          {/* 1. Desktop Sidebar (Persistent) */}
          <aside className="hidden lg:flex w-72 bg-white border-l border-gray-100 flex-col sticky top-0 h-screen z-50">
            <div className="p-8 flex items-center gap-4 border-b border-gray-50 bg-[#005bbf]">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white font-black text-2xl border border-white/30 backdrop-blur-md">
                {teacher?.name?.charAt(0)}
              </div>
              <div>
                <h1 className="text-lg font-black text-white leading-none mb-1">{settings?.systemName || 'إديو سنتر'}</h1>
                <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest leading-none">بوابة المعلم</p>
              </div>
            </div>

            <nav className="flex-1 p-6 space-y-3 mt-4">
              {[
                { id: 'home', label: 'لوحة التحكم', icon: 'space_dashboard' },
                { id: 'students', label: 'طلابي', icon: 'group' },
                { id: 'exams', label: 'الاختبارات', icon: 'grading' },
                { id: 'profile', label: 'الملف الشخصي', icon: 'person_outline' }
              ].map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={cn("w-full h-14 flex items-center gap-4 px-6 rounded-2xl font-black text-sm transition-all", activeTab === item.id ? "bg-blue-50 text-[#005bbf] shadow-sm" : "hover:bg-gray-50 text-gray-500")}>
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: activeTab === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-6 border-t border-gray-50">
              <button onClick={logout} className="w-full h-14 flex items-center gap-4 px-6 rounded-2xl text-red-500 font-black text-sm hover:bg-red-50 transition-all">
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
                  <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white hover:bg-white/10 transition-colors p-2 rounded-xl">
                    <span className="material-symbols-outlined text-2xl">menu</span>
                  </button>
                  <h1 className="text-lg md:text-xl font-bold text-white leading-none tracking-tight lg:hidden">{settings?.systemName || 'إديو سنتر'}</h1>
                  <div className="hidden lg:block text-white/80 font-bold text-sm">
                    {activeTab === 'home' && 'الرئيسية'}
                    {activeTab === 'students' && 'إدارة الطلاب'}
                    {activeTab === 'exams' && 'مركز الاختبارات'}
                    {activeTab === 'profile' && 'الملف الشخصي'}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden border border-white/30 backdrop-blur-md">
                  {teacher?.photoURL ? (
                    <img src={teacher.photoURL} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center text-white font-black text-sm">{teacher?.name?.charAt(0)}</div>
                  )}
                </div>
              </div>
            </header>

        {/* 3. Hero Section (Matched design) */}
        {activeTab === 'home' && (
          <section className="bg-gradient-to-br from-[#1a73e8] via-[#1a73e8] to-[#005bbf] pt-8 pb-10 px-6 text-white rounded-b-none shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
               <div className="absolute top-10 right-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
               <div className="absolute bottom-2 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            </div>
            <div className="max-w-7xl mx-auto relative z-10 text-center md:text-right">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-sm opacity-80 mb-1 font-semibold">أهلاً بك مرة أخرى،</p>
                <h2 className="text-2xl md:text-4xl font-black mb-4 tracking-tighter leading-tight">مستر {teacher?.name}</h2>
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-2xl rounded-xl p-3 inline-flex border border-white/10 shadow-lg">
                  <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center shadow-[0_5px_15px_rgba(250,204,21,0.3)] transition-transform hover:rotate-12">
                    <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xs md:text-sm">أداؤك التعليمي مذهل!</p>
                    <p className="text-[9px] md:text-[10px] opacity-80 font-bold">بإمكانك إدارة طلابك واختباراتك بكل سهولة.</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* 4. Main Content Area */}
        <main className={cn("flex-1 px-6 pb-20 w-full", activeTab === 'home' ? "mt-8" : "pt-12")}>
        {activeTab === 'home' && (
          <div className="space-y-12">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { label: 'طلابي', val: students.length, color: 'blue', icon: 'groups' },
                { label: 'المجموعات', val: groups.length, color: 'purple', icon: 'school' },
                { label: 'الاختبارات', val: exams.length, color: 'orange', icon: 'assignment' },
                { label: 'الحصص اليوم', val: schedules.length, color: 'green', icon: 'auto_awesome_motion' }
              ].map((stat, i) => (
                <Card key={i} className="p-8 rounded-[3rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border-none flex items-center gap-6 group hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                  <div className={cn("w-16 h-16 rounded-[2rem] flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110 group-hover:rotate-6", 
                    stat.color === 'blue' ? "bg-blue-50 text-blue-600" : 
                    stat.color === 'purple' ? "bg-purple-50 text-purple-600" : 
                    stat.color === 'orange' ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                  )}>
                    <span className="material-symbols-outlined text-3xl">{stat.icon}</span>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-gray-900 leading-none mb-1">{stat.val}</p>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.1em]">{stat.label}</p>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-12 space-y-10">
                {/* Today's Schedule Card */}
                <Card className="p-10 rounded-[3.5rem] border-none shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] relative overflow-hidden">
                   <div className="flex items-center justify-between mb-10">
                    <h3 className="text-2xl font-black text-gray-900 flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-[#005bbf] shadow-inner">
                        <span className="material-symbols-outlined text-3xl">event_upcoming</span>
                      </div>
                      جدول حصص اليوم
                    </h3>
                  </div>
                  <div className="space-y-6">
                    {schedules.length === 0 ? (
                      <div className="py-24 flex flex-col items-center justify-center text-gray-300">
                        <span className="material-symbols-outlined text-8xl mb-6 opacity-10">event_busy</span>
                        <p className="text-xl font-bold italic opacity-40">لا يوجد محاضرات في جدولك المجدول اليوم</p>
                      </div>
                    ) : (
                      schedules.map((session, idx) => (
                        <div key={idx} className="bg-gray-50/70 p-8 rounded-[2.5rem] border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-white hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 gap-6">
                          <div className="flex items-center gap-8">
                            <div className="w-20 h-20 bg-white rounded-[2rem] flex flex-col items-center justify-center border-2 border-blue-50 font-black text-[#005bbf] shadow-xl group-hover:bg-blue-600 group-hover:text-white transition-all overflow-hidden">
                              {(() => {
                                const [h, m] = session.startTime.split(':').map(Number);
                                const ampm = h >= 12 ? 'م' : 'ص';
                                const h12 = h % 12 || 12;
                                return (
                                  <>
                                    <span className="text-2xl">{h12}</span>
                                    <span className="text-[10px] opacity-60 -mt-1">{m.toString().padStart(2, '0')} {ampm}</span>
                                  </>
                                );
                              })()}
                            </div>
                            <div>
                               <p className="text-2xl font-black text-gray-900 mb-1">{getGradeName(session.gradeId)}</p>
                               <div className="flex items-center gap-3 text-sm text-gray-500 font-bold">
                                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-xl shadow-sm border border-gray-50">
                                     <span className="material-symbols-outlined text-lg text-blue-500">meeting_room</span>
                                     <span>قاعة {session.room}</span>
                                  </div>
                               </div>
                            </div>
                          </div>
                          <button className="h-14 px-10 bg-white text-blue-600 rounded-2xl font-black text-sm border-2 border-blue-50 hover:bg-blue-600 hover:text-white transition-all shadow-sm">دخول الفصل</button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                {/* Important Alerts & Academic Support - Moved here */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <Card className="p-10 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col bg-white relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-10">
                      <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 shadow-xl shadow-red-50">
                         <span className="material-symbols-outlined text-2xl font-bold">campaign</span>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 leading-none">تنبيهات هامة</h3>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="p-5 rounded-[2rem] bg-amber-50/50 border border-amber-100 flex items-start gap-4 transition-all hover:scale-[1.02]">
                         <span className="material-symbols-outlined text-amber-500 font-bold text-2xl">error</span>
                         <div>
                            <p className="font-black text-amber-900 text-lg">تحديث نتائج الطلاب</p>
                            <p className="text-sm font-bold text-amber-800/60 mt-1 leading-relaxed">يرجى رفع نتائج اختبارات شهر مايو لكافة المجموعات خلال 48 ساعة.</p>
                         </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-10 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col bg-white relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#005bbf] shadow-xl shadow-blue-50">
                         <span className="material-symbols-outlined text-2xl font-bold">contact_support</span>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 leading-none">الدعم الأكاديمي</h3>
                    </div>
                    <div className="p-8 bg-gray-950 rounded-[2.5rem] text-white overflow-hidden relative shadow-2xl flex-1">
                       <div className="relative z-10">
                          <p className="text-xs opacity-60 mb-6 font-bold leading-relaxed">فريق التقنية متاح دائماً لحل أي مشكلة تقنية تواجهك في لوحة التحكم.</p>
                          <button className="w-full h-14 bg-blue-600 rounded-2xl font-black text-base hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/40 active:scale-95">تحدث مع الفريق</button>
                       </div>
                       <span className="material-symbols-outlined absolute -bottom-10 -right-10 text-[10rem] opacity-[0.05] rotate-12">contact_support</span>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-12 animate-in fade-in duration-700">
             <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-10 rounded-[3.5rem] shadow-[0_15px_50px_-20px_rgba(0,0,0,0.03)] border border-gray-50 gap-6">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2">قائمة الطلاب</h2>
                  <p className="text-gray-400 font-bold text-lg">استعرض كافة الطلاب المسجلين في فصولك الدراسية</p>
                </div>
                <div className="flex gap-4">
                   <div className="relative">
                      <input className="h-14 w-full md:w-80 rounded-2xl bg-gray-50 border-none px-6 pr-14 font-bold text-sm focus:ring-2 focus:ring-blue-600" placeholder="ابحث عن طالب بالاسم..." />
                      <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
               {students.length === 0 ? (
                 <div className="col-span-full py-40 flex flex-col items-center justify-center text-gray-300">
                    <span className="material-symbols-outlined text-9xl mb-8 opacity-10">person_off</span>
                    <p className="text-2xl font-black opacity-30 italic">لا يوجد طلاب مسجلون حالياً</p>
                 </div>
               ) : students.map((std, i) => (
                 <Card key={i} className="p-8 rounded-[3rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] border-none group relative overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex flex-col items-center text-center">
                       <div className="w-24 h-24 rounded-[2rem] bg-gray-50 flex items-center justify-center text-[#005bbf] font-black text-4xl mb-6 shadow-inner ring-8 ring-transparent group-hover:ring-blue-50 transition-all">
                          {std.name.charAt(0)}
                       </div>
                       <h4 className="text-xl font-black text-gray-900 mb-2">{std.name}</h4>
                       <Badge className="mb-8 font-black rounded-lg px-4">{getGradeName(std.gradeId)}</Badge>
                       
                       <div className="w-full grid grid-cols-2 gap-4 pt-8 border-t border-gray-50">
                          <button className="flex flex-col items-center gap-1 group/btn">
                             <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center group-hover/btn:bg-green-600 group-hover/btn:text-white transition-all">
                                <span className="material-symbols-outlined text-xl">call</span>
                             </div>
                             <span className="text-[10px] font-black text-gray-400 uppercase">اتصال</span>
                          </button>
                          <button className="flex flex-col items-center gap-1 group/btn">
                             <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover/btn:bg-blue-600 group-hover/btn:text-white transition-all">
                                <span className="material-symbols-outlined text-xl">analytics</span>
                             </div>
                             <span className="text-[10px] font-black text-gray-400 uppercase">تقييم</span>
                          </button>
                       </div>
                    </div>
                 </Card>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="space-y-12 animate-in fade-in duration-700">
             <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-10 rounded-[3.5rem] shadow-[0_15px_50px_-20px_rgba(0,0,0,0.03)] border border-gray-50 gap-6">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2">إدارة الاختبارات</h2>
                  <p className="text-gray-400 font-bold text-lg">قم بإنشاء ومتابعة اختبارات طلابك</p>
                </div>
                <Button onClick={() => { 
                  setIsExamEditorActive(true); 
                  setCurrentExam(null); 
                  setExamForm({ title: '', gradeId: '', date: '', duration: '', totalMarks: '', description: '', accessCode: '', questions: [] }); 
                  setJsonPrompt('');
                }} className="h-16 px-10 rounded-2xl gap-3 text-xl font-black shadow-2xl shadow-blue-200">
                  <span className="material-symbols-outlined">add_circle</span>
                  إضافة اختبار
                </Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {exams.length === 0 ? (
                 <div className="col-span-full py-40 flex flex-col items-center justify-center text-gray-300">
                    <span className="material-symbols-outlined text-9xl mb-8 opacity-10">assignment_late</span>
                    <p className="text-2xl font-black opacity-30 italic">لا يوجد اختبارات مضافة حالياً</p>
                 </div>
               ) : exams.map((exam, i) => (
                 <Card key={i} className="p-8 rounded-[3rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] border-none group relative overflow-hidden flex flex-col space-y-6 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                    <div className="flex justify-between items-start">
                       <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                          <span className="material-symbols-outlined text-3xl">quiz</span>
                       </div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { 
                              setCurrentExam(exam); 
                              setExamForm({ 
                                 title: exam.title, 
                                 gradeId: exam.gradeId, 
                                 date: exam.date, 
                                 duration: exam.duration, 
                                 totalMarks: exam.totalMarks, 
                                 description: exam.description || '',
                                 accessCode: exam.accessCode || '',
                                 questions: exam.questions || []
                              }); 
                              setJsonPrompt('');
                              setIsExamEditorActive(true); 
                           }} className="w-10 h-10 bg-gray-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                             <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                          <button onClick={async () => { if(confirm('هل أنت متأكد من حذف هذا الاختبار؟')) await deleteDoc(doc(db, 'exams', exam.id)); }} className="w-10 h-10 bg-gray-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all">
                             <span className="material-symbols-outlined text-xl">trash</span>
                          </button>
                       </div>
                    </div>
                    <div>
                       <h4 className="text-2xl font-black text-gray-900 mb-2 leading-tight">{exam.title}</h4>
                       <div className="flex flex-wrap gap-2">
                          <Badge className="bg-blue-50 text-blue-600 border-none font-black">{getGradeName(exam.gradeId)}</Badge>
                          <Badge className="bg-green-50 text-green-600 border-none font-black">{exam.totalMarks} درجة</Badge>
                       </div>
                    </div>
                    <div className="pt-6 border-t border-gray-50 flex items-center justify-between text-gray-400 font-bold text-xs uppercase tracking-widest">
                       <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg">calendar_today</span>
                          <span>{exam.date}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg">timer</span>
                          <span>{exam.duration} دقيقة</span>
                       </div>
                    </div>
                 </Card>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-12 animate-in fade-in duration-700 max-w-4xl mx-auto">
             <div className="text-center md:text-right">
                <h2 className="text-3xl font-black text-gray-900 mb-2">الملف الشخصي</h2>
                <p className="text-gray-400 font-bold text-lg">قم بتحديث بياناتك الشخصية وروابط التواصل الخاصة بك</p>
             </div>

             <form onSubmit={handleUpdateProfile} className="space-y-10">
                <Card className="p-10 rounded-[3.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border-none relative overflow-hidden bg-white">
                   <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-full -mr-20 -mt-20"></div>
                   <div className="relative z-10 space-y-10">
                      <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-right">
                         <div className="w-40 h-40 bg-blue-50 rounded-[3rem] flex items-center justify-center text-[#005bbf] text-6xl font-black overflow-hidden shadow-inner flex-shrink-0 border-8 border-white ring-1 ring-blue-50 relative group">
                            {profileForm.photoURL ? (
                              <img src={profileForm.photoURL} alt="Profile" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            ) : (
                              profileForm.name.charAt(0)
                            )}
                         </div>
                         <div className="flex-1 space-y-6 w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <Input label="الاسم الكامل" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} required />
                               <Input label="المادة الدراسية" value={profileForm.subject} onChange={e => setProfileForm({ ...profileForm, subject: e.target.value })} required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <Input label="رقم الهاتف" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} required />
                               <Input label="البريد الإلكتروني للطلاب" type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} placeholder="teacher@example.com" />
                            </div>
                         </div>
                      </div>

                      <div className="space-y-6 pt-10 border-t border-gray-50">
                         <h4 className="text-xl font-black text-gray-900">معلومات إضافية</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="رابط الصورة الشخصية (ImgBB)" value={profileForm.photoURL} onChange={e => setProfileForm({ ...profileForm, photoURL: e.target.value })} placeholder="https://i.ibb.co/..." />
                            <Input label="سنوات الخبرة" value={profileForm.experience} onChange={e => setProfileForm({ ...profileForm, experience: e.target.value })} placeholder="مثال: 10 سنوات خبرة" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700 mr-2">نبذة تعريفية (Bio)</label>
                            <textarea value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} className="w-full bg-gray-50 border-none rounded-3xl p-6 font-bold text-sm min-h-[150px] focus:ring-4 focus:ring-blue-100 transition-all" placeholder="اكتب نبذة عنك وعن أسلوبك في التدريس..." />
                         </div>
                         <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700 mr-2">ملاحظات (Notes)</label>
                            <textarea value={profileForm.notes} onChange={e => setProfileForm({ ...profileForm, notes: e.target.value })} className="w-full bg-gray-50 border-none rounded-3xl p-6 font-bold text-sm min-h-[100px] focus:ring-4 focus:ring-blue-100 transition-all" placeholder="أي ملاحظات إضافية ترغب في تسجيلها..." />
                         </div>
                      </div>

                      <div className="space-y-6 pt-10 border-t border-gray-50">
                        <h4 className="text-xl font-black text-gray-900">الصفوف الدراسية</h4>
                        <div className="p-6 bg-gray-50 rounded-[2.5rem] border border-gray-100 space-y-6">
                           {ACADEMIC_STAGES.map(stage => (
                             <div key={stage.id} className="space-y-3">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-4">{stage.name}</p>
                                <div className="flex flex-wrap gap-2">
                                   {stage.grades.map(grade => (
                                     <button key={grade.id} type="button" onClick={() => toggleGrade(grade.id)} className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all border", profileForm.gradeIds.includes(grade.id) ? "bg-[#005bbf] text-white border-[#005bbf] shadow-lg shadow-blue-100" : "bg-white text-gray-500 border-gray-100")}>
                                        {grade.name}
                                     </button>
                                   ))}
                                </div>
                             </div>
                           ))}
                        </div>
                      </div>

                      <div className="space-y-6 pt-10 border-t border-gray-50">
                         <h4 className="text-xl font-black text-gray-900 border-r-4 border-blue-600 pr-4 mt-4">روابط التواصل</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Input label="فيسبوك" value={profileForm.socialLinks.facebook} onChange={e => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, facebook: e.target.value } })} />
                            <Input label="تويتر" value={profileForm.socialLinks.twitter} onChange={e => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, twitter: e.target.value } })} />
                            <Input label="إنستجرام" value={profileForm.socialLinks.instagram} onChange={e => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, instagram: e.target.value } })} />
                            <Input label="يوتيوب" value={profileForm.socialLinks.youtube} onChange={e => setProfileForm({ ...profileForm, socialLinks: { ...profileForm.socialLinks, youtube: e.target.value } })} />
                         </div>
                      </div>

                      <div className="pt-10 flex justify-end">
                         <Button type="submit" className="h-16 px-16 rounded-2xl text-xl font-black shadow-2xl shadow-blue-200">حفظ التعديلات</Button>
                      </div>
                   </div>
                </Card>
             </form>
          </div>
        )}
        </main>
        
        {/* Footer Design Header Match */}
        <footer className="hidden lg:flex w-full flex-col items-center py-16 px-10 border-t border-gray-100 bg-white mt-auto">
           <div className="flex items-center gap-4 opacity-40 mb-6 group cursor-default">
              <div className="w-10 h-10 bg-gray-900 rounded-xl group-hover:bg-[#005bbf] transition-colors"></div>
              <span className="font-black text-xl text-gray-900">{settings?.systemName || 'إديو سنتر'}</span>
           </div>
           <p className="text-sm font-bold text-gray-400">© 2026 جميع الحقوق محفوظة لـ إديو سنتر. تم التصميم بكل فخر.</p>
        </footer>
      </div>

      {/* 4. Navigation Menu Drawer */}
       <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-xl z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 350 }} className="fixed top-0 right-0 h-full w-85 bg-white z-[70] shadow-2xl flex flex-col p-10" dir="rtl">
              <div className="flex items-center justify-between mb-16">
                 <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-blue-200">
                       {teacher?.name?.charAt(0)}
                    </div>
                    <div>
                       <p className="text-xl font-black text-gray-900">{teacher?.name}</p>
                       <p className="text-sm text-blue-600 font-black uppercase tracking-widest">{teacher?.subject}</p>
                    </div>
                 </div>
                 <button onClick={() => setIsSidebarOpen(false)} className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
                    <span className="material-symbols-outlined text-2xl">close</span>
                 </button>
              </div>

              <div className="flex-1 space-y-4">
                 {[
                   { id: 'home', label: 'لوحة التحكم', icon: 'space_dashboard' },
                   { id: 'students', label: 'طلابي', icon: 'group' },
                   { id: 'exams', label: 'الاختبارات', icon: 'grading' },
                   { id: 'profile', label: 'الملف الشخصي', icon: 'person_outline' }
                 ].map(item => (
                   <button key={item.id} onClick={() => { setActiveTab(item.id as Tab); setIsSidebarOpen(false); }} className={cn("w-full h-18 flex items-center gap-6 px-6 rounded-[1.75rem] font-black text-lg transition-all", activeTab === item.id ? "bg-[#005bbf] text-white shadow-2xl shadow-blue-200" : "hover:bg-gray-50 text-gray-600")}>
                      <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: activeTab === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                      <span>{item.label}</span>
                   </button>
                 ))}
              </div>

              <div className="pt-10 border-t border-gray-100">
                 <button onClick={logout} className="w-full flex items-center gap-6 px-6 h-18 rounded-[1.75rem] text-red-500 font-black hover:bg-red-50 transition-all">
                    <span className="material-symbols-outlined text-3xl">logout</span>
                    <span>خروج آمن</span>
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 5. Mobile Bottom Navbar (Rectangular Design) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] md:hidden">
         {[
           { id: 'home', label: 'الرئيسية', icon: 'dashboard' },
           { id: 'students', label: 'طلابي', icon: 'groups' },
           { id: 'exams', label: 'الامتحانات', icon: 'quiz' },
           { id: 'profile', label: 'حسابي', icon: 'person' }
         ].map(item => {
           const active = activeTab === item.id;
           return (
             <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={cn("flex flex-col items-center justify-center transition-all px-4 py-2 rounded-xl relative", active ? "text-[#005bbf] bg-blue-50/50" : "text-gray-400")}>
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">{item.label}</span>
             </button>
           );
         })}
      </nav>
    </>
  )}
</div>
  );
};

export default TeacherPortal;
