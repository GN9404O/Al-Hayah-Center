import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Grade } from '../types';
import { ACADEMIC_STAGES } from '../lib/constants';
import { Button, Input, Card, cn } from '../components/ui';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Plus, Edit2, Trash2, GraduationCap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function Grades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [currentGrade, setCurrentGrade] = useState<Grade | null>(null);
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    const q = query(collection(db, 'grades'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allGrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
      
      // Cleanup Duplicates logic
      const uniqueGrades: Grade[] = [];
      const seenNames = new Set<string>();
      const duplicatesToDelete: string[] = [];

      allGrades.forEach(g => {
        const nameNormalized = g.name.trim();
        if (seenNames.has(nameNormalized)) {
          duplicatesToDelete.push(g.id);
        } else {
          seenNames.add(nameNormalized);
          uniqueGrades.push(g);
        }
      });

      if (duplicatesToDelete.length > 0) {
        duplicatesToDelete.forEach(async (id) => {
          try {
            await deleteDoc(doc(db, 'grades', id));
          } catch (e) {
            console.error('Error deleting duplicate grade:', e);
          }
        });
      }

      setGrades(uniqueGrades);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    });

    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      // Check for duplicate name
      const duplicate = grades.find(g => 
        g.name.trim() === formData.name.trim() && 
        (!currentGrade || g.id !== currentGrade.id)
      );

      if (duplicate) {
        toast.error('عذراً، هذه المرحلة موجودة بالفعل');
        return;
      }

      if (currentGrade) {
        await updateDoc(doc(db, 'grades', currentGrade.id), {
          name: formData.name,
          updatedAt: serverTimestamp(),
        });
        toast.success('تم تحديث المرحلة بنجاح');
      } else {
        await addDoc(collection(db, 'grades'), {
          name: formData.name,
          createdAt: serverTimestamp(),
        });
        toast.success('تم إضافة المرحلة بنجاح');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving grade:', error);
      handleFirestoreError(error, OperationType.WRITE, 'grades');
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const addStandardGrade = async (name: string) => {
    try {
      if (grades.some(g => g.name === name)) {
        toast.error('هذه المرحلة موجودة بالفعل');
        return;
      }
      await addDoc(collection(db, 'grades'), {
        name,
        createdAt: serverTimestamp(),
      });
      toast.success(`تم إضافة ${name} بنجاح`);
    } catch (error) {
      toast.error('حدث خطأ أثناء الإضافة');
    }
  };

  const setupAllStandardGrades = async () => {
    const allSubGrades = ACADEMIC_STAGES.flatMap(s => s.subGrades);
    const missingGrades = allSubGrades.filter(name => !grades.some(g => g.name === name));
    
    if (missingGrades.length === 0) {
      toast.success('تم إضافة جميع المراحل بالفعل');
      return;
    }

    const t = toast.loading('جاري إضافة المراحل...');
    try {
      await Promise.all(missingGrades.map(name => 
        addDoc(collection(db, 'grades'), {
          name,
          createdAt: serverTimestamp(),
        })
      ));
      toast.success(`تم إضافة ${missingGrades.length} مرحلة بنجاح`, { id: t });
    } catch (error) {
      toast.error('حدث خطأ أثناء الإضافة الجماعية', { id: t });
    }
  };

  const handleDelete = async () => {
    if (!currentGrade) return;
    try {
      await deleteDoc(doc(db, 'grades', currentGrade.id));
      toast.success('تم حذف المرحلة بنجاح');
      setIsConfirmOpen(false);
      setCurrentGrade(null);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const openModal = (grade?: Grade) => {
    if (grade) {
      setCurrentGrade(grade);
      setFormData({ name: grade.name });
    } else {
      setCurrentGrade(null);
      setFormData({ name: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentGrade(null);
    setFormData({ name: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="mb-12">
        <h1 className="text-2xl font-black text-gray-900">المراحل الدراسية</h1>
        <p className="text-gray-500">اختر من المراحل الجاهزة أدناه لتفعيلها في النظام، أو أضف مرحلة مخصصة</p>
      </div>

      {grades.length === 0 && (
        <Card className="mb-12 p-8 border-2 border-dashed border-blue-200 bg-blue-50/50 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-4">
            <GraduationCap size={32} />
          </div>
          <h3 className="text-xl font-black text-blue-900 mb-2">ابدأ بإعداد النظام</h3>
          <p className="text-blue-700 font-bold mb-6 max-w-md">لم يتم تفعيل أي مراحل دراسية بعد. يمكنك الضغط على الزر أدناه لتفعيل جميع الصفوف الدراسية الأساسية بضغطة واحدة.</p>
          <Button 
            onClick={setupAllStandardGrades}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-14 rounded-2xl font-black text-lg shadow-xl shadow-blue-200"
          >
            تفعيل جميع المراحل الأساسية الآن
          </Button>
        </Card>
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-8 bg-blue-600 rounded-full" />
          <h2 className="text-xl font-black text-gray-800">قائمة المراحل المتاحة</h2>
        </div>
        <Button onClick={() => openModal()} className="gap-2 rounded-xl">
          <Plus className="w-5 h-5" />
          <span>إضافة مرحلة مخصصة</span>
        </Button>
      </div>

      {/* Built-in Academic Stages */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
          مراحل النظام الأساسية
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {ACADEMIC_STAGES.map((stage) => (
            <Card key={stage.id} className="bg-blue-50/30 border-blue-100">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{stage.name}</h3>
                    <p className="text-xs text-blue-600 font-bold">مرحلة ثابتة</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stage.subGrades.map((sub, idx) => {
                    const isAdded = grades.some(g => g.name === sub);
                    return (
                      <button 
                        key={idx} 
                        onClick={() => !isAdded && addStandardGrade(sub)}
                        disabled={isAdded}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                          isAdded 
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default" 
                            : "bg-white text-gray-600 border border-blue-50 hover:border-blue-500 hover:text-blue-600 shadow-sm"
                        )}
                      >
                        {sub}
                        {!isAdded && <Plus size={10} className="inline-block mr-1 opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom/Firestore Grades */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="w-2 h-6 bg-gray-900 rounded-full"></span>
          مراحل إضافية (مخصصة)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grades.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-medium">لا توجد مراحل مخصصة مضافة حالياً</p>
            </div>
          ) : (
            grades.map((grade) => (
              <Card key={grade.id} className="group hover:border-blue-200 transition-all duration-300">
              <div className="p-6 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                    {grade.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{grade.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">مرحلة دراسية</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openModal(grade)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setCurrentGrade(grade);
                      setIsConfirmOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>

    <Modal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title={currentGrade ? 'تعديل المرحلة' : 'إضافة مرحلة جديدة'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="اسم المرحلة"
            placeholder="مثال: أولى ثانوي"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
          />
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 rounded-xl h-12">
              {currentGrade ? 'تحديث' : 'إضافة'}
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
        title="حذف المرحلة"
        message={`هل أنت متأكد من حذف مرحلة "${currentGrade?.name}"؟ سيؤدي هذا لحذف جميع المجموعات والطلاب المرتبطين بها.`}
      />
    </div>
  );
}
