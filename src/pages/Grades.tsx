import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Grade } from '../types';
import { Button, Input, Card } from '../components/ui';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900">المراحل الدراسية</h1>
          <p className="text-gray-500">إدارة المراحل التعليمية في المركز</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 rounded-xl">
          <Plus className="w-5 h-5" />
          <span>إضافة مرحلة</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {grades.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <GraduationCap className="mx-auto w-16 h-16 text-gray-200" />
            <p className="text-gray-400">لا توجد مراحل دراسية مضافة بعد</p>
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
