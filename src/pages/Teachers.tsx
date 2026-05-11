import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Teacher, Grade, User } from '../types';
import { ACADEMIC_STAGES } from '../constants';
import { Button, Input, Card, cn } from '../components/ui';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Plus, Edit2, Trash2, UserSquare2, Loader2, Phone, BookOpen, ImageIcon, Check, Filter, ChevronDown, UserPlus, Search, X, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '',
    phone: '', 
    subject: '', 
    notes: '',
    photoURL: '',
    gradeIds: [] as string[],
    bio: '',
    experience: '',
    userId: '',
    socialLinks: {
      facebook: '',
      twitter: '',
      instagram: '',
      youtube: ''
    }
  });

  const subjects = React.useMemo(() => {
    return Array.from(new Set(teachers.map(t => t.subject))).filter(Boolean);
  }, [teachers]);

  const filteredTeachers = React.useMemo(() => {
    if (!selectedSubject) return teachers;
    return teachers.filter(t => t.subject === selectedSubject);
  }, [teachers, selectedSubject]);

  useEffect(() => {
    const unsubTeachers = onSnapshot(query(collection(db, 'teachers'), orderBy('createdAt', 'desc')), (snapshot) => {
      const allTeachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
      
      const uniqueTeachers: Teacher[] = [];
      const seenNames = new Set<string>();
      const duplicatesToDelete: string[] = [];

      allTeachers.forEach(t => {
        const nameNormalized = t.name.trim();
        if (seenNames.has(nameNormalized)) {
          duplicatesToDelete.push(t.id);
        } else {
          seenNames.add(nameNormalized);
          uniqueTeachers.push(t);
        }
      });

      if (duplicatesToDelete.length > 0) {
        duplicatesToDelete.forEach(async (id) => {
          try {
            await deleteDoc(doc(db, 'teachers', id));
          } catch (e) {
            console.error('Error deleting duplicate:', e);
          }
        });
      }

      setTeachers(uniqueTeachers);
    });

    const unsubGrades = onSnapshot(query(collection(db, 'grades'), orderBy('name')), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
      setLoading(false);
    });

    return () => {
      unsubTeachers();
      unsubGrades();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.subject.trim()) return;

    const finalData = {
      ...formData,
      email: formData.email.toLowerCase().trim(),
      name: formData.name.trim(),
    };

    try {
      // Check for name duplicate before proceeding
      const duplicate = teachers.find(t => 
        t.name.trim() === finalData.name && 
        (!currentTeacher || t.id !== currentTeacher.id)
      );

      if (duplicate) {
        toast.error('عذراً، هذا المعلم موجود بالفعل في القائمة');
        return;
      }

      if (currentTeacher) {
        await updateDoc(doc(db, 'teachers', currentTeacher.id), {
          ...finalData,
          updatedAt: serverTimestamp(),
        });

        // If a userId is present, update the user role to teacher
        if (finalData.userId) {
          await updateDoc(doc(db, 'users', finalData.userId), {
            role: 'teacher'
          });
          // Also remove from students collection immediately
          try {
            await deleteDoc(doc(db, 'students', finalData.userId));
          } catch (e) {
            console.error('Error removing student document:', e);
          }
        }
        
        toast.success('تم تحديث بيانات المعلم بنجاح');
      } else {
        const docRef = await addDoc(collection(db, 'teachers'), {
          ...finalData,
          createdAt: serverTimestamp(),
        });

        // If a userId is present, update the user role to teacher
        if (finalData.userId) {
          await updateDoc(doc(db, 'users', finalData.userId), {
            role: 'teacher'
          });
          // Also remove from students collection immediately
          try {
            await deleteDoc(doc(db, 'students', finalData.userId));
          } catch (e) {
            console.error('Error removing student document:', e);
          }
        }
        
        toast.success('تم إضافة المعلم بنجاح');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving teacher:', error);
      handleFirestoreError(error, OperationType.WRITE, 'teachers');
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async () => {
    if (!currentTeacher) return;
    try {
      await deleteDoc(doc(db, 'teachers', currentTeacher.id));
      toast.success('تم حذف المعلم بنجاح');
      setIsConfirmOpen(false);
      setCurrentTeacher(null);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const toggleGrade = (gradeId: string) => {
    setFormData(prev => ({
      ...prev,
      gradeIds: prev.gradeIds.includes(gradeId)
        ? prev.gradeIds.filter(id => id !== gradeId)
        : [...prev.gradeIds, gradeId]
    }));
  };

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('email'),
        where('email', '>=', userSearchQuery.toLowerCase()),
        where('email', '<=', userSearchQuery.toLowerCase() + '\uf8ff')
      );
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    } catch (e) {
      console.error('Error searching users:', e);
      toast.error('حدث خطأ أثناء البحث عن المستخدمين');
    } finally {
      setSearchingUsers(false);
    }
  };

  const selectUser = (user: User) => {
    setFormData(prev => ({ ...prev, userId: user.id }));
    setIsUserSearchOpen(false);
    setUserSearchQuery('');
    setUsers([]);
  };

  const openModal = (teacher?: Teacher) => {
    if (teacher) {
      setCurrentTeacher(teacher);
      setFormData({ 
        name: teacher.name, 
        email: teacher.email || '',
        phone: teacher.phone, 
        subject: teacher.subject, 
        notes: teacher.notes || '',
        photoURL: teacher.photoURL || '',
        gradeIds: teacher.gradeIds || [],
        bio: teacher.bio || '',
        experience: teacher.experience || '',
        userId: teacher.userId || '',
        socialLinks: {
          facebook: teacher.socialLinks?.facebook || '',
          twitter: teacher.socialLinks?.twitter || '',
          instagram: teacher.socialLinks?.instagram || '',
          youtube: teacher.socialLinks?.youtube || '',
        }
      });
    } else {
      setCurrentTeacher(null);
      setFormData({ 
        name: '', 
        email: '',
        phone: '', 
        subject: '', 
        notes: '',
        photoURL: '',
        gradeIds: [],
        bio: '',
        experience: '',
        userId: '',
        socialLinks: {
          facebook: '',
          twitter: '',
          instagram: '',
          youtube: ''
        }
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentTeacher(null);
    setFormData({ 
      name: '', 
      email: '',
      phone: '', 
      subject: '', 
      notes: '', 
      photoURL: '', 
      gradeIds: [], 
      bio: '', 
      experience: '',
      userId: '',
      socialLinks: { facebook: '', twitter: '', instagram: '', youtube: '' }
    });
  };

  const deleteAllTeachers = async () => {
    try {
      const deletePromises = teachers.map(t => deleteDoc(doc(db, 'teachers', t.id)));
      await Promise.all(deletePromises);
      toast.success('تم مسح جميع المعلمين بنجاح');
      setIsDeleteAllConfirmOpen(false);
    } catch (e) {
      toast.error('حدث خطأ أثناء المسح');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">المعلمون</h1>
          <p className="text-gray-500">إدارة الكادر التدريسي في المركز</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsDeleteAllConfirmOpen(true)} 
            className="gap-2 rounded-xl border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="w-5 h-5" />
            <span>مسح الكل</span>
          </Button>
          <Button onClick={() => openModal()} className="gap-2 rounded-xl">
            <Plus className="w-5 h-5" />
            <span>إضافة معلم</span>
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-blue-600 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-xl font-black">ربط حساب معلم جديد ههنا</h2>
            <p className="text-blue-100 text-sm font-medium">أضف بريد المعلم الإلكتروني لتمكينه من الدخول للوحة التحكم الخاصة به فوراً</p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-1 md:w-64">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <input 
                type="email"
                placeholder="بريد المعلم الإلكتروني..."
                className="w-full h-12 bg-white/20 border border-white/30 rounded-xl pr-12 pl-4 text-white placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 font-bold"
                onKeyPress={async (e) => {
                  if (e.key === 'Enter') {
                    const email = (e.target as HTMLInputElement).value;
                    if (email) {
                      // Check if teacher exists with this email
                      const q = query(collection(db, 'teachers'), where('email', '==', email.toLowerCase()));
                      const teacherSnap = await getDocs(q);
                      if (teacherSnap.empty) {
                        toast.error('لم يتم العثور على معلم بهذا البريد الإلكتروني. يرجى إضافة المعلم أولاً.');
                      } else {
                        toast.success('سيتم تحويل المستخدم لمعلم عند دخوله للمنصة');
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }
                }}
              />
            </div>
            <Button className="bg-white text-blue-600 hover:bg-blue-50 border-none rounded-xl h-12 font-black px-6 shadow-lg">
              ربط سريع
            </Button>
          </div>
        </div>
      </Card>

      {subjects.length > 0 && (
        <div className="relative inline-block text-right">
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="gap-2 rounded-xl border-gray-200 bg-white"
          >
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="font-bold">{selectedSubject || 'كل المواد'}</span>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isFilterOpen && "rotate-180")} />
          </Button>

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
                  className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setSelectedSubject(null);
                        setIsFilterOpen(false);
                      }}
                      className={cn(
                        "w-full text-right px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-between",
                        selectedSubject === null ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
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
                          "w-full text-right px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-between",
                          selectedSubject === sub ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
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
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <UserSquare2 className="mx-auto w-16 h-16 text-gray-200" />
            <p className="text-gray-400">لا يوجد معلمون مطابقون للبحث</p>
          </div>
        ) : (
          filteredTeachers.map((teacher) => (
            <Card key={teacher.id} className="group hover:border-blue-200 transition-all duration-300 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl overflow-hidden shadow-inner">
                      {teacher.photoURL ? (
                        <img src={teacher.photoURL} alt={teacher.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        teacher.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{teacher.name}</h3>
                      <div className="flex items-center gap-1 text-[#1a73e8] text-xs font-bold px-2 py-0.5 bg-blue-50 rounded-full w-fit">
                        <BookOpen className="w-3 h-3" />
                        <span>{teacher.subject}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openModal(teacher)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setCurrentTeacher(teacher);
                        setIsConfirmOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{teacher.phone}</span>
                  </div>
                  
                  {teacher.gradeIds && teacher.gradeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {teacher.gradeIds.map(gid => {
                        // Check built-in grades first
                        let gName = '';
                        for (const stage of ACADEMIC_STAGES) {
                          const g = stage.grades.find(grade => grade.id === gid);
                          if (g) {
                            gName = g.name;
                            break;
                          }
                        }
                        
                        if (!gName) {
                          gName = grades.find(g => g.id === gid)?.name || gid;
                        }

                        return (
                          <span key={gid} className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">
                            {gName}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {teacher.notes && (
                    <p className="text-xs text-gray-400 line-clamp-2 mt-2 leading-relaxed italic">
                      " {teacher.notes} "
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title={currentTeacher ? 'تعديل بيانات المعلم' : 'إضافة معلم جديد'}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="اسم المعلم"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="البريد الإلكتروني (لتسجيل الدخول)"
              type="email"
              placeholder="teacher@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="رقم الهاتف"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
            <Input
              label="المادة"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="الخبرة (مثال: 10 سنوات خبرة)"
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            />
            <Input
              label="رابط الصورة (ImgBB)"
              placeholder="https://i.ibb.co/..."
              value={formData.photoURL}
              onChange={(e) => setFormData({ ...formData, photoURL: e.target.value })}
              icon={<ImageIcon className="w-4 h-4" />}
            />
          </div>

          <div className="space-y-3 p-4 border border-blue-100 rounded-2xl bg-blue-50/20">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-blue-900">حساب المعلم (تسجيل الدخول)</h4>
              {formData.userId ? (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, userId: '' }))}
                  className="text-xs text-red-500 font-bold hover:underline"
                >
                  إلغاء الربط
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsUserSearchOpen(true)}
                  className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"
                >
                  <UserPlus className="w-3 h-3" />
                  ربط حساب مستخدم
                </button>
              )}
            </div>
            
            {formData.userId ? (
              <div className="flex items-center gap-3 p-3 bg-white border border-blue-200 rounded-xl">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <UserSquare2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">تم ربط الحساب</p>
                  <p className="text-xs text-gray-400">ID: {formData.userId}</p>
                </div>
                <div className="mr-auto">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-white/50 border border-dashed border-blue-200 rounded-xl">
                <p className="text-xs text-gray-400">لا يوجد حساب مستخدم مرتبط بهذا المعلم</p>
                <p className="text-[10px] text-gray-400 mt-1">يجب ربط حساب لتمكين المعلم من الدخول للوحة التحكم الخاصة به</p>
              </div>
            )}
          </div>

          <div className="space-y-4 p-4 border border-blue-50 rounded-2xl bg-blue-50/30">
            <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-2">روابط التواصل الاجتماعي</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="فيسبوك"
                value={formData.socialLinks.facebook}
                onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, facebook: e.target.value } })}
              />
              <Input
                label="إنستجرام"
                value={formData.socialLinks.instagram}
                onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, instagram: e.target.value } })}
              />
              <Input
                label="تويتر"
                value={formData.socialLinks.twitter}
                onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, twitter: e.target.value } })}
              />
              <Input
                label="يوتيوب"
                value={formData.socialLinks.youtube}
                onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, youtube: e.target.value } })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-700">النبذة التعريفية (Bio)</label>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] min-h-[100px] transition-all bg-white"
              value={formData.bio}
              placeholder="اكتب نبذة عن المعلم وطريقة تدريسه..."
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">الصفوف الدراسية</label>
            <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              {ACADEMIC_STAGES.map(stage => (
                <div key={stage.id} className="space-y-2">
                  <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{stage.name}</h5>
                  <div className="flex flex-wrap gap-2">
                    {stage.grades.map(grade => (
                      <button
                        key={grade.id}
                        type="button"
                        onClick={() => toggleGrade(grade.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          formData.gradeIds.includes(grade.id)
                            ? 'bg-[#1a73e8] text-white shadow-md'
                            : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                      >
                        {formData.gradeIds.includes(grade.id) && <Check className="w-3 h-3" />}
                        {grade.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              
              {grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">صفوف مخصصة</h5>
                  <div className="flex flex-wrap gap-2">
                    {grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).map(grade => (
                      <button
                        key={grade.id}
                        type="button"
                        onClick={() => toggleGrade(grade.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          formData.gradeIds.includes(grade.id)
                            ? 'bg-gray-800 text-white shadow-md'
                            : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                      >
                        {formData.gradeIds.includes(grade.id) && <Check className="w-3 h-3" />}
                        {grade.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] min-h-[80px]"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 rounded-xl h-12">
              {currentTeacher ? 'تحديث' : 'إضافة'}
            </Button>
            <Button type="button" variant="outline" onClick={closeModal} className="flex-1 rounded-xl h-12">
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="حذف المعلم"
        message={`هل أنت متأكد من حذف المعلم "${currentTeacher?.name}"؟`}
      />

      <ConfirmModal
        isOpen={isDeleteAllConfirmOpen}
        onClose={() => setIsDeleteAllConfirmOpen(false)}
        onConfirm={deleteAllTeachers}
        title="مسح جميع المعلمين"
        message="هل أنت متأكد من مسح جميع المعلمين؟ لا يمكن التراجع عن هذا الإجراء."
      />

      <Modal
        isOpen={isUserSearchOpen}
        onClose={() => setIsUserSearchOpen(false)}
        title="البحث عن مستخدم لربطه"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="ابحث بالبريد الإلكتروني..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="flex-1"
              onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
            />
            <Button onClick={handleSearchUsers} disabled={searchingUsers}>
              {searchingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {users.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">أدخل بريداً إلكترونياً صحيحاً للبحث</p>
            ) : (
              users.map(user => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors text-right"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <UserSquare2 className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="p-2 text-blue-600">
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
