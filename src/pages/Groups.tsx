import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  serverTimestamp,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { Group, Grade, Teacher, Student, GroupSession } from '../types';
import { Card, Badge, Button, cn } from '../components/ui';
import { 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  ArrowRight, 
  ArrowLeft,
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  XCircle,
  Save,
  ChevronLeft,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  // Sync selected teacher with updated data from Firestore
  useEffect(() => {
    if (selectedTeacher) {
      const updated = teachers.find(t => t.id === selectedTeacher.id);
      if (updated) setSelectedTeacher(updated);
    }
  }, [teachers]);

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GroupSession | null>(null);

  useEffect(() => {
    if (isAddingGroup) {
      setFormData(prev => ({
        ...prev,
        teacherId: selectedTeacher?.id || prev.teacherId,
        gradeId: selectedGrade?.id || prev.gradeId,
        subject: selectedTeacher?.subject || prev.subject,
        name: prev.name || (selectedGrade ? selectedGrade.name : '')
      }));
    }
  }, [isAddingGroup, selectedTeacher, selectedGrade]);

  const [formData, setFormData] = useState({
    name: '',
    gradeId: '',
    teacherId: '',
    subject: '',
    capacity: 30
  });

  const [sessionFormData, setSessionFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sessionPrice: 50
  });

  const [sessionRecords, setSessionRecords] = useState<any[]>([]);
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
      setLoading(false);
    });

    const unsubGrades = onSnapshot(collection(db, 'grades'), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    });

    return () => {
      unsubGroups();
      unsubGrades();
      unsubTeachers();
      unsubStudents();
    };
  }, []);

  useEffect(() => {
    if (!selectedGroup) return;
    
    const q = query(
      collection(db, 'group_sessions'),
      where('groupId', '==', selectedGroup.id),
      orderBy('date', 'desc')
    );

    const unsubSessions = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupSession)));
    });

    return () => unsubSessions();
  }, [selectedGroup]);

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'groups'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      setIsAddingGroup(false);
      setFormData({ name: '', gradeId: '', teacherId: '', subject: '', capacity: 30 });
      toast.success('تمت إضافة المجموعة بنجاح');
    } catch (error) {
      toast.error('خطأ في إضافة المجموعة');
    }
  };

  const handleAddSession = async () => {
    if (!selectedGroup) return;

    // Initialize records with group students
    const groupStudents = students.filter(s => s.groupId === selectedGroup.id);
    const initialRecords = groupStudents.map(s => ({
      studentId: s.id,
      studentName: s.name,
      attended: true,
      amountPaid: sessionFormData.sessionPrice,
      isFullPayment: false
    }));

    setSessionRecords(initialRecords);
    setIsAddingSession(true);
  };

  const saveSession = async () => {
    if (!selectedGroup) return;

    try {
      const sessionData = {
        groupId: selectedGroup.id,
        date: sessionFormData.date,
        sessionPrice: Number(sessionFormData.sessionPrice),
        records: sessionRecords.map(r => {
          const deficit = r.isFullPayment ? 0 : Math.max(0, Number(sessionFormData.sessionPrice) - Number(r.amountPaid));
          const change = Math.max(0, Number(r.amountPaid) - Number(sessionFormData.sessionPrice));
          return {
            ...r,
            deficit,
            change,
            balance: deficit // Keeping for backward compatibility if needed, or just remove if safe
          };
        }),
        createdAt: serverTimestamp()
      };

      if (selectedSession?.id) {
        await updateDoc(doc(db, 'group_sessions', selectedSession.id), sessionData);
        toast.success('تم تحديث الحصة بنجاح');
      } else {
        await addDoc(collection(db, 'group_sessions'), sessionData);
        toast.success('تم تسجيل الحصة بنجاح');
      }

      setIsAddingSession(false);
      setSelectedSession(null);
    } catch (error) {
      toast.error('خطأ في حفظ الحصة');
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onResolve: (result: boolean) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onResolve: () => {},
  });

  const confirmAction = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onResolve: (result) => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          resolve(result);
        }
      });
    });
  };

  const deleteGroup = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!id) return false;

    const confirmed = await confirmAction(
      'حذف المجموعة',
      'هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جميع الحصص المرتبطة بها وجميع بيانات التحصيل.'
    );

    if (!confirmed) return false;

    try {
      // 1. Delete all sessions for this group
      const q = query(collection(db, 'group_sessions'), where('groupId', '==', id));
      const sessionsSnapshot = await getDocs(q);
      const sessionDeletes = sessionsSnapshot.docs.map(sessionDoc => deleteDoc(sessionDoc.ref));
      await Promise.all(sessionDeletes);

      // 2. Clear groupId for all students in this group
      const studentsInGroup = students.filter(s => s.groupId === id);
      const studentUpdates = studentsInGroup.map(student => 
        updateDoc(doc(db, 'students', student.id), { groupId: '' })
      );
      await Promise.all(studentUpdates);

      // 3. Delete the group document
      await deleteDoc(doc(db, 'groups', id));
      
      toast.success('تم حذف المجموعة وجميع بياناتها بنجاح');
      return true;
    } catch (error) {
      console.error('Delete group error:', error);
      toast.error('حدث خطأ أثناء حذف المجموعة من قاعدة البيانات');
      return false;
    }
  };

  const deleteSession = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!id) return false;

    const confirmed = await confirmAction(
      'حذف سجل الحصة',
      'هل أنت متأكد من حذف هذا السجل بشكل نهائي؟ لا يمكن التراجع عن هذه الخطوة.'
    );

    if (!confirmed) return false;

    try {
      await deleteDoc(doc(db, 'group_sessions', id));
      toast.success('تم حذف السجل بنجاح من قاعدة البيانات');
      return true;
    } catch (error) {
      console.error('Delete session error:', error);
      toast.error('حدث خطأ أثناء حذف السجل من قاعدة البيانات');
      return false;
    }
  };

  const removeStudentFromGroup = async (studentId: string, studentName: string) => {
    const confirmed = await confirmAction(
      'حذف طالب من المجموعة',
      `هل أنت متأكد من حذف ${studentName} من هذه المجموعة؟`
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'students', studentId), { groupId: '' });
      toast.success('تم حذف الطالب من المجموعة');
    } catch (error) {
      console.error('Remove student error:', error);
      toast.error('خطأ في حذف الطالب');
    }
  };

  const assignGradeToTeacher = async (gradeId: string) => {
    if (!selectedTeacher) return;
    try {
      const currentGradeIds = selectedTeacher.gradeIds || [];
      if (currentGradeIds.includes(gradeId)) return;
      
      const newGradeIds = [...currentGradeIds, gradeId];
      await updateDoc(doc(db, 'teachers', selectedTeacher.id), {
        gradeIds: newGradeIds,
        updatedAt: serverTimestamp()
      });
      toast.success('تمت إضافة المرحلة للمدرس');
    } catch (e) {
      toast.error('خطأ في تحديث مراحل المدرس');
    }
  };

  const getGradeName = (id: string) => grades.find(g => g.id === id)?.name || '-';
  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || '-';

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">المجموعات الدراسية</h1>
          <p className="text-gray-500 font-bold">إدارة المجموعات، الحضور، والمدفوعات</p>
        </div>
        <Button 
          onClick={() => setIsAddingGroup(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-[2rem] shadow-xl shadow-blue-900/20 font-black flex items-center gap-2 group"
        >
          <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
          مجموعة جديدة
        </Button>
      </div>

      {isAddingGroup && (
        <Card className="p-8 rounded-[3rem] border-2 border-blue-50 shadow-2xl animate-in zoom-in-95 duration-300">
          <form onSubmit={handleAddGroup} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 mr-2">اسم المجموعة</label>
              <input
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="مثال: مجموعة الفيزياء - السبت"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 mr-2">المرحلة الدراسية</label>
              <select
                required
                value={formData.gradeId}
                onChange={e => {
                  const gradeId = e.target.value;
                  const gradeName = grades.find(g => g.id === gradeId)?.name || '';
                  // Only auto-fill name if it's currently empty or was previously a grade name
                  const isCurrentNameAGrade = !formData.name || grades.some(g => g.name === formData.name);
                  setFormData({ 
                    ...formData, 
                    gradeId, 
                    name: isCurrentNameAGrade ? gradeName : formData.name 
                  });
                }}
                className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">اختر المرحلة</option>
                {grades.length === 0 && (
                  <option disabled className="text-red-500">
                    لا يوجد مراحل! اذهب لصفحة "المراحل" لإضافتها
                  </option>
                )}
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 mr-2">المعلم</label>
              <select
                required
                value={formData.teacherId}
                onChange={e => {
                  const teacherId = e.target.value;
                  const teacher = teachers.find(t => t.id === teacherId);
                  setFormData({ 
                    ...formData, 
                    teacherId,
                    subject: teacher?.subject || formData.subject
                  });
                }}
                className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">اختر المعلم</option>
                {teachers.length === 0 && <option disabled>لا يوجد معلمون مسجلون</option>}
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 mr-2">المادة</label>
              <input
                required
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="المادة الدراسية"
              />
            </div>
            <div className="flex gap-4 items-end">
              <Button type="submit" className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 font-black">حفظ</Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddingGroup(false)}
                className="h-14 rounded-2xl border-gray-100 font-bold"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </Card>
      )}

      {selectedGroup ? (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setSelectedGroup(null); setIsAddingSession(false); setSelectedSession(null); }}
                className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-500 hover:text-blue-600 transition-all shadow-sm"
              >
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
              <div className="text-right font-black">
                <h2 className="text-2xl text-gray-900">{selectedGroup.name}</h2>
                <p className="text-blue-600">{getGradeName(selectedGroup.gradeId)} - {selectedGroup.subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                type="button"
                onClick={async (e) => {
                  const deleted = await deleteGroup(selectedGroup.id, e);
                  if (deleted) {
                    setSelectedGroup(null);
                  }
                }}
                className="border-red-100 text-red-600 hover:bg-red-50 rounded-xl font-bold h-11"
              >
                <Trash2 size={18} className="ml-2" />
                حذف المجموعة
              </Button>
            </div>
          </div>

          {isAddingSession ? (
            <Card className="p-8 rounded-[3rem] shadow-2xl animate-in slide-in-from-top duration-500">
              <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 pr-2">تاريخ الحصة</label>
                    <input 
                      type="date"
                      value={sessionFormData.date}
                      onChange={e => setSessionFormData({...sessionFormData, date: e.target.value})}
                      className="w-full h-12 bg-gray-50 rounded-xl px-4 font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 pr-2">سعر الحصة (ج.م)</label>
                    <input 
                      type="number"
                      value={sessionFormData.sessionPrice}
                      onChange={e => {
                        const price = Number(e.target.value);
                        setSessionFormData({...sessionFormData, sessionPrice: price});
                        // Update all unpaid records to the new price by default
                        setSessionRecords(prev => prev.map(r => ({
                          ...r,
                          amountPaid: r.amountPaid === sessionFormData.sessionPrice ? price : r.amountPaid
                        })));
                      }}
                      className="w-full h-12 bg-blue-50/50 text-blue-600 rounded-xl px-4 font-black outline-none border-2 border-blue-100/50 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedSession && (
                    <Button 
                      variant="outline" 
                      type="button"
                      onClick={async (e) => {
                        const deleted = await deleteSession(selectedSession.id, e);
                        if (deleted) {
                          setIsAddingSession(false);
                          setSelectedSession(null);
                        }
                      }} 
                      className="h-12 rounded-xl font-bold border-red-100 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={18} className="ml-2" />
                      حذف الحصة
                    </Button>
                  )}
                  <Button onClick={saveSession} className="bg-emerald-600 hover:bg-emerald-700 px-8 h-12 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                    <Save size={18} />
                    حفظ السجل
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingSession(false)} className="h-12 rounded-xl font-bold border-gray-100">إلغاء</Button>
                </div>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    placeholder="إضافة طالب يدوي للمجموعة..."
                    className="w-full h-10 bg-white border border-gray-100 rounded-xl pr-10 pl-4 font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    value={sessionSearchTerm}
                    onChange={(e) => setSessionSearchTerm(e.target.value)}
                  />
                  {sessionSearchTerm && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-50 max-h-64 overflow-y-auto z-10 p-2">
                      {students
                        .filter(s => s.name.toLowerCase().includes(sessionSearchTerm.toLowerCase()) && !sessionRecords.find(r => r.studentId === s.id))
                        .map(s => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSessionRecords([...sessionRecords, {
                                studentId: s.id,
                                studentName: s.name,
                                attended: true,
                                amountPaid: sessionFormData.sessionPrice,
                                isFullPayment: false
                              }]);
                              setSessionSearchTerm('');
                            }}
                            className="w-full p-3 text-right hover:bg-blue-50 font-bold text-gray-700 rounded-lg flex items-center justify-between"
                          >
                            <span>{s.name}</span>
                            <Plus size={14} className="text-blue-600" />
                          </button>
                        ))
                      }
                      
                      {/* Manual Entry Option */}
                      <button
                        onClick={() => {
                          setSessionRecords([...sessionRecords, {
                            studentId: `manual_${Date.now()}`,
                            studentName: sessionSearchTerm,
                            attended: true,
                            amountPaid: sessionFormData.sessionPrice,
                            isManual: true,
                            isFullPayment: false
                          }]);
                          setSessionSearchTerm('');
                        }}
                        className="w-full p-4 mt-1 text-right bg-blue-50 hover:bg-blue-100 font-black text-blue-700 rounded-xl flex items-center justify-between border border-blue-100 shadow-sm transition-all"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs opacity-60">إضافة طالب غير مسجل:</span>
                          <span>{sessionSearchTerm}</span>
                        </div>
                        <CheckCircle2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-gray-400">
                  <Badge className="bg-white border-gray-200 text-gray-500">عدد الطلاب المختارين: {sessionRecords.length}</Badge>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-50">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">إجراء</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">اسم الطالب</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">حضور</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">المدفوع</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">الباقي</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">العجز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sessionRecords.map((record, idx) => {
                      const amountPaid = Number(record.amountPaid) || 0;
                      const deficit = record.isFullPayment ? 0 : Math.max(0, sessionFormData.sessionPrice - amountPaid);
                      const change = Math.max(0, amountPaid - sessionFormData.sessionPrice);
                      
                      return (
                        <tr key={idx} className={cn(
                          "hover:bg-gray-50/30 transition-colors",
                          record.isFullPayment && record.attended && (sessionFormData.sessionPrice - amountPaid) > 0 && "bg-emerald-50/10"
                        )}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button 
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const confirmed = await confirmAction('حذف من الحصة', 'هل أنت متأكد من حذف هذا الطالب من سجل الحصة؟');
                                  if (confirmed) {
                                    setSessionRecords(prev => prev.filter((_, i) => i !== idx));
                                  }
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all relative z-10"
                                title="حذف من الحصة"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  const newRecords = [...sessionRecords];
                                  newRecords[idx].isFullPayment = !newRecords[idx].isFullPayment;
                                  setSessionRecords(newRecords);
                                }}
                                title={record.isFullPayment ? "إلغاء تخفيض" : "اعتبار المبلغ دافع بالكامل"}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                  record.isFullPayment ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                )}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-700">{record.studentName}</span>
                                {record.studentId.startsWith('manual_') && (
                                  <Badge className="bg-amber-50 text-amber-600 border-none text-[8px] px-1 rounded">يدوي</Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 font-black">{record.studentId}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => {
                                const newRecords = [...sessionRecords];
                                newRecords[idx].attended = !newRecords[idx].attended;
                                // If marked absent, clear the amount paid
                                if (!newRecords[idx].attended) {
                                  newRecords[idx].amountPaid = 0;
                                } else {
                                  newRecords[idx].amountPaid = sessionFormData.sessionPrice;
                                }
                                setSessionRecords(newRecords);
                              }}
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto shadow-sm",
                                record.attended ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                              )}
                            >
                              {record.attended ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="relative inline-block w-28">
                              <input 
                                type="number"
                                value={record.amountPaid}
                                disabled={!record.attended}
                                onChange={e => {
                                  const newRecords = [...sessionRecords];
                                  newRecords[idx].amountPaid = e.target.value;
                                  setSessionRecords(newRecords);
                                }}
                                className={cn(
                                  "w-full h-10 rounded-lg pr-8 text-center font-black outline-none focus:ring-1",
                                  !record.attended ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-100 focus:ring-blue-500"
                                )}
                              />
                              <DollarSign className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge className={cn(
                                "font-black px-3 py-1 rounded-lg min-w-[60px] text-center",
                                !record.attended || change === 0 ? "bg-gray-50 text-gray-300" : "bg-blue-50 text-blue-600"
                            )}>
                              {record.attended && change > 0 ? `${change} ج` : '-'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge className={cn(
                                "font-black px-3 py-1 rounded-lg min-w-[60px] text-center",
                                !record.attended ? "bg-gray-50 text-gray-300" :
                                deficit === 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600 animate-pulse"
                            )}>
                              {record.attended ? `${deficit} ج` : '-'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {sessionRecords.length > 0 && (
                      <tr className="bg-blue-50/30 border-t-2 border-blue-100">
                        <td colSpan={2} className="px-6 py-6 font-black text-blue-900 text-lg">الخلاصة الإجمالية</td>
                        <td className="px-6 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-gray-400">القيمة الإجمالية</span>
                            <span className="font-black text-gray-600 text-lg">
                              {(sessionRecords.filter(r => r.attended).length * sessionFormData.sessionPrice)} ج
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-emerald-600">التحصيل</span>
                            <span className="font-black text-emerald-700 text-xl">
                              {sessionRecords.reduce((acc, r) => acc + (Number(r.amountPaid) || 0), 0)} ج
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-blue-600">الباقي (زيادة)</span>
                            <span className="font-black text-blue-700 text-xl">
                              {sessionRecords.reduce((acc, r) => {
                                if (!r.attended) return acc;
                                const c = Math.max(0, Number(r.amountPaid) - sessionFormData.sessionPrice);
                                return acc + c;
                              }, 0)} ج
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-red-600">العجز (نقص)</span>
                            <span className="font-black text-red-700 text-xl">
                              {sessionRecords.reduce((acc, r) => {
                                if (!r.attended || r.isFullPayment) return acc;
                                const d = Math.max(0, sessionFormData.sessionPrice - (Number(r.amountPaid) || 0));
                                return acc + d;
                              }, 0)} ج
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {sessionRecords.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-20 text-center text-gray-300 font-bold italic">لا يوجد طلاب مسجلين في هذه المجموعة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-800">تاريخ الحصص</h3>
                <Button onClick={handleAddSession} className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl gap-2">
                  <Calendar size={18} />
                  تسجيل حصة جديدة
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map((session) => (
                  <Card key={session.id} className="p-6 rounded-[2rem] border-none shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-[1rem] flex items-center justify-center">
                        <Calendar size={24} />
                      </div>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedSession(session);
                              setSessionRecords(session.records);
                              setSessionFormData({ 
                                date: session.date, 
                                sessionPrice: session.sessionPrice || 50 
                              });
                              setIsAddingSession(true);
                            }}
                            className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                            title="عرض الحضور"
                          >
                            <Users size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => deleteSession(session.id, e)}
                            className="w-9 h-9 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm relative z-10"
                            title="حذف الحصة"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm font-black text-gray-400">تاريخ الحصة</p>
                          <p className="text-lg font-black text-gray-800">{new Date(session.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div className="text-left bg-blue-50 px-3 py-1 rounded-lg">
                           <p className="text-[10px] font-black text-blue-400">سعر الحصة</p>
                           <p className="text-sm font-black text-blue-700">{session.sessionPrice || 0} ج</p>
                        </div>
                      </div>
                      <div className="flex justify-between pt-4 border-t border-gray-50">
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase">الحضور</p>
                          <p className="text-sm font-black text-emerald-600">{session.records?.filter((r: any) => r.attended).length || 0}</p>
                        </div>
                        <div className="text-center border-x border-gray-50 px-6">
                          <p className="text-[10px] font-black text-gray-400 uppercase">العجز</p>
                          <p className="text-sm font-black text-red-600">
                             {session.records?.reduce((acc: number, r: any) => {
                               if (!r.attended || r.isFullPayment) return acc;
                               const d = Math.max(0, (session.sessionPrice || 0) - (Number(r.amountPaid) || 0));
                               return acc + d;
                             }, 0)}ج
                          </p>
                        </div>
                        <div className="text-center ml-4">
                          <p className="text-[10px] font-black text-gray-400 uppercase">الباقي</p>
                          <p className="text-sm font-black text-blue-600">
                             {session.records?.reduce((acc: number, r: any) => {
                               if (!r.attended) return acc;
                               const c = Math.max(0, (Number(r.amountPaid) || 0) - (session.sessionPrice || 0));
                               return acc + c;
                             }, 0)}ج
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase">التحصيل</p>
                          <p className="text-sm font-black text-emerald-600">{session.records?.reduce((acc: number, r: any) => acc + (Number(r.amountPaid) || 0), 0)}ج</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {sessions.length === 0 && (
                  <div className="col-span-full py-20 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300">
                    <Calendar size={48} className="mb-4 opacity-20" />
                    <p className="font-bold italic">لا يوجد حصص مسجلة لهذه المجموعة</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-10 border-t border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-800">الطلاب المسجلين في المجموعة</h3>
              <Badge className="bg-gray-100 text-gray-500 font-black">{students.filter(s => s.groupId === selectedGroup.id).length} طالب</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {students.filter(s => s.groupId === selectedGroup.id).map(student => (
                <div key={student.id} className="p-4 bg-white rounded-2xl border border-gray-50 flex items-center justify-between group hover:border-blue-100 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{student.name}</p>
                      <p className="text-[10px] text-gray-400 font-black">{student.phone}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeStudentFromGroup(student.id, student.name)}
                    className="w-8 h-8 md:opacity-0 group-hover:opacity-100 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : selectedTeacher ? (
        selectedGrade ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedGrade(null)}
                  className="w-12 h-12 rounded-2xl border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-100 transition-all"
                >
                  <ArrowRight size={20} />
                </Button>
                <div>
                  <h2 className="text-3xl font-black text-gray-900">{selectedGrade.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-blue-600 text-white border-none font-black">{selectedTeacher.name}</Badge>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => setIsAddingGroup(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl font-black gap-2 shadow-lg shadow-emerald-900/10"
              >
                <Plus size={18} />
                إضافة حصة/مجموعة
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups
                .filter(g => g.teacherId === selectedTeacher.id && g.gradeId === selectedGrade.id)
                .map((group) => (
                  <Card 
                    key={group.id} 
                    className="p-8 rounded-[2.5rem] shadow-sm border border-gray-50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col space-y-4 group cursor-pointer bg-white"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <BookOpen size={28} />
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => deleteGroup(group.id, e)}
                        className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all relative z-10"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-gray-900 mb-1">{group.name}</h4>
                      <Badge className="bg-purple-50 text-purple-600 border-none font-black">{group.subject}</Badge>
                    </div>
                    <div className="pt-4 border-t border-gray-50 mt-auto flex items-center justify-end">
                      <div className="text-blue-600 group-hover:translate-x-2 transition-transform">
                        <ArrowLeft size={20} />
                      </div>
                    </div>
                  </Card>
                ))}
              {groups.filter(g => g.teacherId === selectedTeacher.id && g.gradeId === selectedGrade.id).length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-300">
                  <p className="font-bold italic">لا يوجد مجموعات لهذا المدرس في هذه المرحلة</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTeacher(null)}
                  className="w-12 h-12 rounded-2xl border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-100 transition-all"
                >
                  <ArrowRight size={20} />
                </Button>
                <div>
                  <h2 className="text-3xl font-black text-gray-900">{selectedTeacher.name}</h2>
                  <p className="text-blue-600 font-bold">اختر المرحلة الدراسية</p>
                </div>
              </div>
              <Button 
                onClick={() => setIsAddingGroup(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-black gap-2 shadow-lg shadow-blue-900/10"
              >
                <Plus size={18} />
                مجموعة جديدة للمدرس
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {grades.length === 0 ? (
                <Card className="col-span-full p-12 bg-blue-50 border-2 border-dashed border-blue-200 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
                    <GraduationCap size={44} />
                  </div>
                  <h3 className="text-2xl font-black text-blue-900 mb-2">تنبيه: المراحل لم يتم تفعيلها بعد</h3>
                  <p className="text-blue-700 font-bold mb-8 max-w-sm">
                    المراحل الدراسية موجودة كقوالب في الموقع، لكن يجب عليك "تفعيلها" من صفحة المراحل لتتمكن من استخدامها في المجموعات.
                  </p>
                  <Button 
                    onClick={() => navigate('/grades')}
                    className="bg-blue-600 text-white rounded-2xl h-14 px-10 font-black text-lg shadow-lg shadow-blue-200"
                  >
                    اذهب لتفعيل المراحل الآن
                  </Button>
                </Card>
              ) : (
                <>
                  {grades
                    .filter(grade => (selectedTeacher.gradeIds || []).includes(grade.id) || groups.some(g => g.teacherId === selectedTeacher.id && g.gradeId === grade.id))
                    .map((grade) => {
                      const gradeGroups = groups.filter(g => g.teacherId === selectedTeacher.id && g.gradeId === grade.id);
                      return (
                        <Card 
                          key={grade.id} 
                          className={cn(
                            "p-8 rounded-[2.5rem] shadow-sm border-none hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer bg-white text-center",
                            gradeGroups.length === 0 && "opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                          )}
                          onClick={() => setSelectedGrade(grade)}
                        >
                          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] mx-auto mb-4 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                            <GraduationCap size={40} />
                          </div>
                          <h3 className="text-xl font-black text-gray-900">{grade.name}</h3>
                          <p className="text-sm text-gray-400 font-bold mt-2">
                            {gradeGroups.length} مجموعات
                          </p>
                          {gradeGroups.length === 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-center gap-1 text-blue-600 text-xs font-black">
                              <Plus size={12} />
                              إنشاء أول مجموعة
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  
                  {/* Add Grade Section */}
                  {grades.filter(g => !(selectedTeacher.gradeIds || []).includes(g.id)).length > 0 && (
                    <div className="col-span-full mt-12 bg-gray-50/50 p-8 rounded-[3rem] border border-dashed border-gray-200">
                       <div className="flex items-center gap-2 mb-6">
                          <Plus className="text-blue-600" size={24} />
                          <h4 className="text-lg font-black text-gray-800">إضافة مراحل أخرى لهذا المدرس</h4>
                       </div>
                       <div className="flex flex-wrap gap-3">
                          {grades
                            .filter(g => !(selectedTeacher.gradeIds || []).includes(g.id))
                            .map(g => (
                               <button
                                  key={g.id}
                                  onClick={() => assignGradeToTeacher(g.id)}
                                  className="px-6 py-3 bg-white text-gray-600 border border-gray-100 rounded-2xl font-bold text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center gap-2 group/btn"
                               >
                                  <Plus size={16} className="text-blue-500 group-hover/btn:text-white" />
                                  {g.name}
                               </button>
                            ))
                          }
                       </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teachers.map((teacher) => (
            <Card 
              key={teacher.id} 
              className="p-8 rounded-[3rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] border-none hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex items-center gap-6 group cursor-pointer bg-white"
              onClick={() => setSelectedTeacher(teacher)}
            >
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[3rem] flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                <Users size={44} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black text-gray-900 mb-1 leading-tight">{teacher.name}</h3>
                <div className="flex flex-wrap gap-2">
                   <Badge className="bg-blue-50 text-blue-600 border-none font-black">{teacher.subject}</Badge>
                   <Badge className="bg-gray-50 text-gray-400 border-none font-black text-[10px]">
                     {groups.filter(g => g.teacherId === teacher.id).length} مجموعات
                   </Badge>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                <ArrowLeft size={24} />
              </div>
            </Card>
          ))}
          {teachers.length === 0 && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-gray-300">
               <span className="material-symbols-outlined text-9xl mb-8 opacity-10">person_off</span>
               <p className="text-2xl font-black opacity-30 italic">لا يوجد معلمين مسجلين</p>
            </div>
          )}
        </div>
      )}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => confirmDialog.onResolve(false)}
          />
          <Card className="relative w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 border-none">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-black text-gray-900">{confirmDialog.title}</h3>
              <p className="text-gray-500 font-bold leading-relaxed">{confirmDialog.message}</p>
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={() => confirmDialog.onResolve(true)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black h-12 rounded-xl"
                >
                  تأكيد الحذف
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => confirmDialog.onResolve(false)}
                  className="flex-1 border-gray-100 font-bold h-12 rounded-xl"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
