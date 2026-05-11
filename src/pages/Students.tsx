import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, where, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Student, Grade, Group } from '../types';
import { ACADEMIC_STAGES, getGradeNameById } from '../constants';
import { Button, Input, Card, Badge, cn } from '../components/ui';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Plus, Edit2, Trash2, Users2, Loader2, Phone, Search, Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');

  const [formData, setFormData] = useState({ 
    name: '', 
    email: '',
    phone: '', 
    parentPhone: '', 
    gradeId: '', 
    groupId: '', 
    notes: '' 
  });

  useEffect(() => {
    const unsubGrades = onSnapshot(collection(db, 'grades'), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    });
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      // Sort in memory to avoid filtering docs missing the orderBy field
      const sortedStudents = allStudents.sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });
      setStudents(sortedStudents);
      setLoading(false);
    });

    return () => {
      unsubGrades();
      unsubGroups();
      unsubStudents();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.gradeId) {
      toast.error('يرجى إكمال الحقول الأساسية');
      return;
    }

    try {
      if (currentStudent) {
        await updateDoc(doc(db, 'students', currentStudent.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        toast.success('تم تحديث بيانات الطالب');
      } else {
        await addDoc(collection(db, 'students'), {
          ...formData,
          createdAt: serverTimestamp(),
        });
        toast.success('تم إضافة الطالب بنجاح');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving student:', error);
      handleFirestoreError(error, OperationType.WRITE, 'students');
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async () => {
    if (!currentStudent) return;
    try {
      await deleteDoc(doc(db, 'students', currentStudent.id));
      toast.success('تم حذف الطالب من القائمة');
      setIsConfirmOpen(false);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const openModal = (student?: Student) => {
      if (student) {
        setCurrentStudent(student);
        setFormData({ 
          name: student.name, 
          email: student.email || '',
          phone: student.phone, 
          parentPhone: student.parentPhone, 
          gradeId: student.gradeId, 
          groupId: student.groupId, 
          notes: student.notes || '' 
        });
      } else {
        setCurrentStudent(null);
        setFormData({ name: '', email: '', phone: '', parentPhone: '', gradeId: '', groupId: '', notes: '' });
      }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentStudent(null);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          s.phone.includes(searchTerm) || 
                          s.parentPhone.includes(searchTerm);
    
    // Support matching both built-in grades and stage groups
    const matchesGrade = filterGrade ? (
      s.gradeId === filterGrade || 
      ACADEMIC_STAGES.find(stage => stage.id === filterGrade)?.grades.some(g => g.id === s.gradeId)
    ) : true;
    
    return matchesSearch && matchesGrade;
  });

  const getGradeName = (id: string) => getGradeNameById(id, grades);
  const getGroupName = (id: string) => groups.find(g => g.id === id)?.name || '-';

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">الطلاب</h1>
          <p className="text-gray-500">إدارة بيانات الطلاب المسجلين</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openModal()} className="gap-2 rounded-xl">
            <Plus className="w-5 h-5" />
            <span>إضافة طالب</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="بحث بالاسم أو رقم الهاتف..." 
            className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select 
            className="bg-gray-50 border-none rounded-xl text-sm py-2 px-4 focus:ring-2 focus:ring-blue-500/20"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
          >
            <option value="">جميع المراحل والصفوف</option>
            {ACADEMIC_STAGES.map(stage => (
              <optgroup key={stage.id} label={stage.name}>
                <option value={stage.id}>كل {stage.name}</option>
                {stage.grades.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </optgroup>
            ))}
            {grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).length > 0 && (
              <optgroup label="مراحل مخصصة">
                {grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-sm font-bold text-gray-600">الطالب</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-600">المرحلة</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-600">الهاتف</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400">لا توجد نتائج بحث مطابقة</td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{student.name}</div>
                    {student.email && <div className="text-xs text-gray-400">{student.email}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={student.gradeId ? "default" : "warning"}>
                      {student.gradeId ? getGradeName(student.gradeId) : 'غير مسجل'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm flex items-center gap-1">
                        <Phone className="w-3 h-3 text-blue-500" /> 
                        {student.phone || 'بدون هاتف'}
                      </div>
                      {student.parentPhone && <div className="text-xs text-gray-400">ولي الأمر: {student.parentPhone}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal(student)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { setCurrentStudent(student); setIsConfirmOpen(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="اسم الطالب" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <Input label="البريد الإلكتروني" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={!!currentStudent && !!formData.email} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="رقم هاتف الطالب" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
            <Input label="رقم هاتف ولي الأمر" value={formData.parentPhone} onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })} required />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-4 p-4 bg-blue-50/30 rounded-2xl border border-blue-100">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-blue-900">المرحلة الدراسية</label>
                <select 
                  className="w-full rounded-xl border-none bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500" 
                  value={selectedStageId || ACADEMIC_STAGES.find(s => s.grades.some(g => g.id === formData.gradeId))?.id || ''} 
                  onChange={(e) => {
                    setSelectedStageId(e.target.value);
                    setFormData({ ...formData, gradeId: '' });
                  }}
                  required
                >
                  <option value="">اختر المرحلة</option>
                  {ACADEMIC_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {grades.filter(g => !ACADEMIC_STAGES.some(s => s.id === g.id)).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {(selectedStageId || ACADEMIC_STAGES.find(s => s.grades.some(g => g.id === formData.gradeId))) && ACADEMIC_STAGES.find(s => s.id === (selectedStageId || ACADEMIC_STAGES.find(st => st.grades.some(g => g.id === formData.gradeId))?.id)) && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-blue-900">الصف الدراسي</label>
                  <select 
                    className="w-full rounded-xl border-none bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500" 
                    value={formData.gradeId} 
                    onChange={(e) => setFormData({ ...formData, gradeId: e.target.value })} 
                    required
                  >
                    <option value="">اختر الصف</option>
                    {ACADEMIC_STAGES.find(s => s.id === (selectedStageId || ACADEMIC_STAGES.find(st => st.grades.some(g => g.id === formData.gradeId))?.id))?.grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
            <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[80px]" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 rounded-xl h-12">{currentStudent ? 'تحديث' : 'إضافة'}</Button>
            <Button type="button" variant="outline" onClick={closeModal} className="flex-1 rounded-xl h-12">إلغاء</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleDelete} title="حذف الطالب" message={`هل أنت متأكد من حذف الطالب "${currentStudent?.name}"؟`} />
    </div>
  );
}
