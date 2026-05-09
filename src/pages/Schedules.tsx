import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Schedule, Grade, Group, Teacher } from '../types';
import { ACADEMIC_STAGES, getGradeNameById } from '../constants';
import { Button, Input, Card, Badge } from '../components/ui';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Plus, Edit2, Trash2, Calendar, Loader2, Clock, MapPin, User, BookOpen, AlertCircle, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_LABELS: Record<string, string> = {
  'Saturday': 'السبت',
  'Sunday': 'الأحد',
  'Monday': 'الاثنين',
  'Tuesday': 'الثلاثاء',
  'Wednesday': 'الأربعاء',
  'Thursday': 'الخميس',
  'Friday': 'الجمعة'
};

export function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteDayConfirmOpen, setIsDeleteDayConfirmOpen] = useState(false);
  const [dayToDelete, setDayToDelete] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');

  const [formData, setFormData] = useState({
    gradeId: '',
    groupId: '',
    teacherId: '',
    subject: '',
    day: 'Saturday',
    startTime: '09:00',
    endTime: '11:00',
    isExam: false,
    room: '',
    notes: ''
  });

  useEffect(() => {
    const unsubGrades = onSnapshot(collection(db, 'grades'), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    });
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    });
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
      setLoading(false);
    });

    return () => {
      unsubGrades();
      unsubGroups();
      unsubTeachers();
      unsubSchedules();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.gradeId || !formData.groupId || !formData.day) {
      toast.error('يرجى إكمال جميع الحقول المطلوبة');
      return;
    }

    try {
      let groupId = formData.groupId;
      
      // If no group is selected (since we might have hidden it), find or create a default one
      if (!groupId && formData.gradeId) {
        const defaultGroup = groups.find(g => g.name === 'أساسي' && g.gradeId === formData.gradeId);
        if (defaultGroup) {
          groupId = defaultGroup.id;
        } else {
          const newGroupRef = await addDoc(collection(db, 'groups'), {
            name: 'أساسي',
            gradeId: formData.gradeId,
            subject: formData.subject,
            teacherId: formData.teacherId,
            createdAt: serverTimestamp(),
          });
          groupId = newGroupRef.id;
        }
      }

      if (currentSchedule) {
        await updateDoc(doc(db, 'schedules', currentSchedule.id), {
          ...formData,
          groupId,
          updatedAt: serverTimestamp(),
        });
        toast.success('تم تحديث الجدول بنجاح');
      } else {
        await addDoc(collection(db, 'schedules'), {
          ...formData,
          groupId,
          createdAt: serverTimestamp(),
        });
        toast.success('تم إضافة الموعد بنجاح');
      }
      closeModal();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async () => {
    if (!currentSchedule) return;
    try {
      await deleteDoc(doc(db, 'schedules', currentSchedule.id));
      toast.success('تم حذف الموعد');
      setIsConfirmOpen(false);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleDeleteDay = async () => {
    if (!dayToDelete) return;
    try {
      const daySchedules = schedules.filter(s => s.day === dayToDelete);
      const deletePromises = daySchedules.map(s => deleteDoc(doc(db, 'schedules', s.id)));
      await Promise.all(deletePromises);
      toast.success(`تم مسح مواعيد يوم ${DAY_LABELS[dayToDelete]} بنجاح`);
      setIsDeleteDayConfirmOpen(false);
      setDayToDelete(null);
    } catch (error) {
      toast.error('حدث خطأ أثناء مسح اليوم');
    }
  };

  const toggleDayCollapse = (day: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
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

  const openModal = (schedule?: Schedule) => {
    if (schedule) {
      setCurrentSchedule(schedule);
      setFormData({ 
        gradeId: schedule.gradeId, 
        groupId: schedule.groupId, 
        teacherId: schedule.teacherId, 
        subject: schedule.subject, 
        day: schedule.day as any, 
        startTime: schedule.startTime, 
        endTime: schedule.endTime, 
        isExam: schedule.isExam || false,
        room: schedule.room, 
        notes: schedule.notes || '' 
      });
    } else {
      setCurrentSchedule(null);
      setFormData({ gradeId: '', groupId: '', teacherId: '', subject: '', day: 'Saturday', startTime: '09:00', endTime: '11:00', isExam: false, room: '', notes: '' });
    }
    setIsModalOpen(true);
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    
    // Track newly created items to avoid duplicates within the same import session
    const localGradeMap = new Map<string, string>(); // name -> id
    const localTeacherMap = new Map<string, string>(); // name -> id
    const localGroupMap = new Map<string, string>(); // gradeId_name -> id

    try {
      let cleanedText = importText.trim();
      // Remove markdown code blocks if present
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```[a-z]*\s+/i, '').replace(/\s+```$/m, '');
      }

      let data: any[] = [];
      try {
        data = JSON.parse(cleanedText);
      } catch (e) {
        toast.error('تنسيق البيانات غير صحيح. يرجى إدخال JSON صالح');
        setIsImporting(false);
        return;
      }

      if (!Array.isArray(data)) {
        toast.error('يجب أن تكون البيانات عبارة عن مصفوفة (Array)');
        setIsImporting(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      
      // Phase 1: Pre-resolve all gradeIds and collect unique (day, gradeId) pairs
      const itemsToProcess = [];
      const cleanupKeys = new Set<string>(); // "day_gradeId"

      for (const item of data) {
        // Flexible field mapping
        let gName = String(item.gradeName || item.grade || item['المرحلة'] || item['اسم_المرحلة'] || '').trim();
        let gradeId = item.gradeId;
        
        if (!gradeId && gName) {
          // Normalize and look in built-in stages first
          const normalizedGName = gName.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
          let foundBuiltIn = false;
          
          for (const stage of ACADEMIC_STAGES) {
            const builtInGrade = stage.grades.find(g => {
              const normalizedStageGrade = g.name.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
              return g.name === gName || normalizedStageGrade === normalizedGName;
            });
            if (builtInGrade) {
              gradeId = builtInGrade.id;
              foundBuiltIn = true;
              break;
            }
          }

          if (!foundBuiltIn) {
            const existingGrade = grades.find(g => {
              const normalizedG = g.name.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
              return g.name === gName || normalizedG === normalizedGName;
            });
            
            if (existingGrade) {
              gradeId = existingGrade.id;
            } else if (localGradeMap.has(gName)) {
              gradeId = localGradeMap.get(gName);
            } else {
              try {
                const newGradeRef = await addDoc(collection(db, 'grades'), {
                  name: gName,
                  createdAt: serverTimestamp(),
                });
                gradeId = newGradeRef.id;
                localGradeMap.set(gName, gradeId);
              } catch (e) {
                console.error("Failed to create grade", gName, e);
                errorCount++;
                continue;
              }
            }
          }
        }

        if (!gradeId) {
          console.warn("Skipping item: missing gradeId and gradeName", item);
          errorCount++;
          continue;
        }

        // Map day to standard English labels
        let dayRaw = String(item.day || item['اليوم'] || '').trim();
        const normalizedDayRaw = dayRaw.replace(/[أإآ]/g, 'ا');
        
        const dayLabelAr = Object.entries(DAY_LABELS).find(([key, label]) => {
          const normalizedLabel = label.replace(/[أإآ]/g, 'ا');
          return (
            label === dayRaw || 
            key.toLowerCase() === dayRaw.toLowerCase() ||
            normalizedLabel === normalizedDayRaw
          );
        })?.[0];
        
        if (dayLabelAr) {
          const day = dayLabelAr;
          cleanupKeys.add(`${day}_${gradeId}`);
          itemsToProcess.push({ ...item, gradeId, resolvedDay: day });
        } else {
          console.warn("Skipping item: invalid day label", dayRaw, item);
          errorCount++;
        }
      }

      // Phase 2: Cleanup existing schedules for the identified days/grades
      if (itemsToProcess.length > 0) {
        const schedulesToDelete = schedules.filter(s => cleanupKeys.has(`${s.day}_${s.gradeId}`));
        if (schedulesToDelete.length > 0) {
          const deletePromises = schedulesToDelete.map(s => deleteDoc(doc(db, 'schedules', s.id)));
          await Promise.all(deletePromises);
        }
      }

      // Phase 3: Add new schedules
      for (const item of itemsToProcess) {
        const { gradeId, resolvedDay: day } = item;
        try {
          // Resolve or Create Teacher
          const tName = String(item.teacherName || item.teacher || item['المعلم'] || item['اسم_المعلم'] || '').trim();
          let teacherId = item.teacherId;
          
          if (!teacherId && tName) {
            const normalizedTName = tName.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
            const existingTeacher = teachers.find(t => {
              const normalizedEx = t.name.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
              return t.name === tName || normalizedEx === normalizedTName;
            });

            if (existingTeacher) {
              teacherId = existingTeacher.id;
              // Ensure grade is attached to teacher
              if (!existingTeacher.gradeIds?.includes(gradeId)) {
                await updateDoc(doc(db, 'teachers', teacherId), {
                  gradeIds: [...(existingTeacher.gradeIds || []), gradeId]
                });
              }
            } else if (localTeacherMap.has(tName)) {
              teacherId = localTeacherMap.get(tName);
            } else {
              const newTeacherRef = await addDoc(collection(db, 'teachers'), {
                name: tName,
                subject: item.subject || item['المادة'] || 'غير محدد',
                gradeIds: [gradeId],
                phone: '00000000000',
                createdAt: serverTimestamp(),
              });
              teacherId = newTeacherRef.id;
              localTeacherMap.set(tName, teacherId);
            }
          }

          // Resolve or Create Group
          const groupNameInput = item.groupName || item.group || item['المجموعة'] || item['اسم_المجموعة'] || 'أساسي';
          const groupName = String(groupNameInput).trim();
          let groupId = item.groupId;
          const groupKey = `${gradeId}_${groupName}`;

          if (!groupId) {
            const existingGroup = groups.find(g => g.name === groupName && g.gradeId === gradeId);
            if (existingGroup) {
              groupId = existingGroup.id;
            } else if (localGroupMap.has(groupKey)) {
              groupId = localGroupMap.get(groupKey);
            } else {
              const newGroupRef = await addDoc(collection(db, 'groups'), {
                name: groupName,
                gradeId,
                teacherId: teacherId || '',
                subject: item.subject || item['المادة'] || 'غير محدد',
                createdAt: serverTimestamp(),
              });
              groupId = newGroupRef.id;
              localGroupMap.set(groupKey, groupId);
            }
          }

          // Ensure time format is HH:mm
          let startTime = String(item.startTime || item.start || item['وقت_البدء'] || item['البداية'] || '00:00').trim();
          // Convert 09:00 AM/PM if AI sent it, or handle 9:00
          if (startTime.includes(' ')) {
            const parts = startTime.split(' ');
            let [h, m] = parts[0].split(':');
            let hour = parseInt(h);
            if (parts[1].toLowerCase().includes('p') && hour < 12) hour += 12;
            if (parts[1].toLowerCase().includes('a') && hour === 12) hour = 0;
            startTime = `${hour.toString().padStart(2, '0')}:${m || '00'}`;
          } else if (startTime.match(/^\d{1,2}:\d{2}$/)) {
            const [h, m] = startTime.split(':');
            startTime = `${h.padStart(2, '0')}:${m}`;
          }

          let endTime = String(item.endTime || item.end || item['وقت_الانتهاء'] || item['النهاية'] || '').trim();
          if (endTime) {
            if (endTime.includes(' ')) {
              const parts = endTime.split(' ');
              let [h, m] = parts[0].split(':');
              let hour = parseInt(h);
              if (parts[1].toLowerCase().includes('p') && hour < 12) hour += 12;
              if (parts[1].toLowerCase().includes('a') && hour === 12) hour = 0;
              endTime = `${hour.toString().padStart(2, '0')}:${m || '00'}`;
            } else if (endTime.match(/^\d{1,2}:\d{2}$/)) {
              const [h, m] = endTime.split(':');
              endTime = `${h.padStart(2, '0')}:${m}`;
            }
          }

          const subject = String(item.subject || item['المادة'] || 'غير محدد').trim();
          const isExam = !!(item.isExam || subject.includes('امتحان') || groupName.includes('امتحان'));
          const room = String(item.room || item['القاعة'] || '').trim();
          const notes = String(item.notes || item['ملاحظات'] || '').trim();

          await addDoc(collection(db, 'schedules'), {
            gradeId,
            groupId,
            teacherId: teacherId || '',
            subject,
            day,
            startTime,
            endTime,
            isExam,
            room,
            notes,
            createdAt: serverTimestamp(),
          });
          
          successCount++;
        } catch (innerError) {
          console.error("Error processing item:", item, innerError);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`تم إضافة ${successCount} مواعيد بنجاح`);
      }
      if (errorCount > 0) {
        toast.error(`فشل في معالجة ${errorCount} عنصر`);
      }
      
      if (successCount > 0) {
        setIsImportModalOpen(false);
        setImportText('');
      }
    } catch (error) {
      console.error("Bulk Import Error:", error);
      toast.error('حدث خطأ أثناء الاستيراد');
    } finally {
      setIsImporting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentSchedule(null);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  const groupedSchedules = DAYS.map(day => ({
    day,
    label: DAY_LABELS[day],
    items: schedules.filter(s => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }));

  const getGradeName = (id: string) => getGradeNameById(id, grades);
  const getGroupName = (id: string) => groups.find(g => g.id === id)?.name || '-';
  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900">جداول المواعيد</h1>
          <p className="text-gray-500">إدارة وتنظيم المواعيد الأسبوعية</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2 rounded-xl">
            <Calendar className="w-5 h-5" />
            <span>استيراد ذكي</span>
          </Button>
          <Button onClick={() => openModal()} className="gap-2 rounded-xl">
            <Plus className="w-5 h-5" />
            <span>إضافة موعد</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-7 gap-4 items-start">
        {groupedSchedules.map((group) => (
          <div key={group.day} className="space-y-4">
            <div className={`bg-blue-600 text-white rounded-xl py-3 px-4 flex items-center justify-between font-bold shadow-md transition-all ${collapsedDays.has(group.day) ? 'bg-blue-800' : ''}`}>
              <button 
                onClick={() => toggleDayCollapse(group.day)}
                className="flex items-center gap-2 hover:scale-110 transition-transform"
              >
                {collapsedDays.has(group.day) ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                <span>{group.label}</span>
              </button>
              
              <button 
                onClick={() => { setDayToDelete(group.day); setIsDeleteDayConfirmOpen(true); }}
                className="text-white/60 hover:text-red-300 transition-colors"
                title="مسح محتوى اليوم"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            
            <AnimatePresence>
              {!collapsedDays.has(group.day) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 min-h-[10px] overflow-hidden"
                >
                  {group.items.length === 0 ? (
                    <div className="bg-white border border-gray-100 rounded-xl p-4 text-center text-xs text-gray-300 italic">
                      لا توجد مواعيد
                    </div>
                  ) : (
                    group.items.map((item) => (
                      <Card key={item.id} className={`p-4 border-l-4 group relative ${item.isExam ? 'border-l-red-500 bg-red-50/30' : 'border-l-blue-500'}`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${item.isExam ? 'text-red-600' : 'text-blue-600'}`}>{item.subject}</span>
                              {item.isExam && <Badge variant="danger" className="text-[8px] px-1 py-0 h-4">امتحان</Badge>}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openModal(item)} className="text-gray-300 hover:text-blue-600"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => { setCurrentSchedule(item); setIsConfirmOpen(true); }} className="text-gray-300 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                          <h4 className="font-bold text-gray-900 text-sm">{getGroupName(item.groupId)}</h4>
                          <div className="space-y-1 text-[11px] text-gray-500">
                            <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime12h(item.startTime)} - {item.endTime ? formatTime12h(item.endTime) : '--:--'}</div>
                            <div className="flex items-center gap-1"><User className="w-3 h-3" /> {getTeacherName(item.teacherId)}</div>
                            <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.room}</div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentSchedule ? 'تعديل موعد' : 'إضافة موعد جديد'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <Input label="المادة" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} required />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">المعلم</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={formData.teacherId} onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })} required>
                <option value="">اختر المعلم</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">اليوم</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={formData.day} onChange={(e) => setFormData({ ...formData, day: e.target.value as any })} required>
                {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
            </div>
            <Input label="من" type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} required />
            <Input label="إلى" type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} required />
          </div>

          <Input label="القاعة / الغرفة" placeholder="مثال: قاعة 1" value={formData.room} onChange={(e) => setFormData({ ...formData, room: e.target.value })} required />

          <div className="flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
            <input 
              type="checkbox" 
              id="isExam" 
              checked={formData.isExam} 
              onChange={(e) => setFormData({ ...formData, isExam: e.target.checked })}
              className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
            />
            <label htmlFor="isExam" className="text-sm font-bold text-red-700 cursor-pointer flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              هذا الموعد عبارة عن امتحان
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 rounded-xl h-12">{currentSchedule ? 'تحديث' : 'إضافة'}</Button>
            <Button type="button" variant="outline" onClick={closeModal} className="flex-1 rounded-xl h-12">إلغاء</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleDelete} title="حذف الموعد" message="هل أنت متأكد من حذف هذا الموعد من الجدول؟" />

      <ConfirmModal 
        isOpen={isDeleteDayConfirmOpen} 
        onClose={() => setIsDeleteDayConfirmOpen(false)} 
        onConfirm={handleDeleteDay} 
        title={`مسح مواعيد يوم ${dayToDelete ? DAY_LABELS[dayToDelete] : ''}`} 
        message={`هل أنت متأكد من مسح جميع المواعيد المسجلة ليوم ${dayToDelete ? DAY_LABELS[dayToDelete] : ''}؟ لا يمكن التراجع عن هذا الفعل.`} 
      />

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="الاستيراد الذكي للجداول" size="2xl">
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 leading-relaxed">
            <p className="font-bold mb-2">كيفية الاستخدام:</p>
            <ol className="list-decimal list-inside space-y-1 mb-3">
              <li>قم بإرسال صورة الجدول لـ ChatGPT أو Gemini.</li>
              <li>اطلب منه تحويلها إلى JSON بهذا التنسيق (استخدم نظام 24 ساعة للوقت):</li>
            </ol>

            <div className="bg-white p-3 rounded-lg border border-blue-100 mb-4">
              <p className="font-bold text-[10px] text-blue-900 mb-2 uppercase tracking-widest">أسماء الصفوف المعتمدة في النظام:</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {ACADEMIC_STAGES.map(stage => (
                  <div key={stage.id} className="space-y-1">
                    <p className="font-black text-gray-400">{stage.name}:</p>
                    <ul className="list-disc list-inside px-1">
                      {stage.grades.map(g => <li key={g.id}>{g.name}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <pre className="mt-2 p-2 bg-white rounded border border-blue-200 overflow-x-auto">
{`[
  {
    "gradeName": "الصف الثالث الثانوي",
    "teacherName": "محمد علي",
    "subject": "فيزياء",
    "day": "الاثنين",
    "startTime": "08:00",
    "endTime": "09:30",
    "isExam": false,
    "room": "قاعة 1"
  }
]`}
            </pre>
            <p className="mt-2">3. انسخ الـ JSON الناتج وضعه هنا ثم اضغط "بدء الاستيراد".</p>
          </div>
          
          <textarea
            className="w-full h-64 p-4 rounded-xl border border-gray-200 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="انسخ كود الـ JSON هنا..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            dir="ltr"
          />
          
          <div className="flex gap-3">
            <Button 
              onClick={handleBulkImport} 
              className="flex-1 rounded-xl h-12 gap-2"
              disabled={isImporting || !importText.trim()}
            >
              {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
              <span>بدء الاستيراد</span>
            </Button>
            <Button 
              onClick={() => setIsImportModalOpen(false)} 
              variant="outline" 
              className="flex-1 rounded-xl h-12"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
