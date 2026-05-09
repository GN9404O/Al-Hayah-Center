import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, Badge, Button, cn } from '../components/ui';
import { 
  Users2, 
  UserSquare2, 
  GraduationCap, 
  Users, 
  Calendar,
  Clock,
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { useSettings } from '../contexts/SettingsContext';

export function Dashboard() {
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    grades: 0,
    groups: 0,
    schedules: 0
  });
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (s) => setStats(prev => ({ ...prev, students: s.size })), (e) => console.error("Students list error:", e));
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (s) => setStats(prev => ({ ...prev, teachers: s.size })), (e) => console.error("Teachers list error:", e));
    const unsubGrades = onSnapshot(collection(db, 'grades'), (s) => setStats(prev => ({ ...prev, grades: s.size })), (e) => console.error("Grades list error:", e));
    const unsubGroups = onSnapshot(collection(db, 'groups'), (s) => setStats(prev => ({ ...prev, groups: s.size })), (e) => console.error("Groups list error:", e));
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (s) => {
      setStats(prev => ({ ...prev, schedules: s.size }));
      const sorted = s.docs.map(doc => ({ id: doc.id, ...doc.data() })).slice(0, 5);
      setRecentSchedules(sorted);
    }, (e) => console.error("Schedules list error:", e));

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubGrades();
      unsubGroups();
      unsubSchedules();
    };
  }, []);

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

  const chartData = [
    { name: 'الطلاب', value: stats.students, color: '#3b82f6' },
    { name: 'المعلمون', value: stats.teachers, color: '#f59e0b' },
    { name: 'المراحل', value: stats.grades, color: '#8b5cf6' },
    { name: 'الجداول', value: stats.schedules, color: '#10b981' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-500">مرحباً بك مجدداً في نظام إدارة {settings?.systemName || 'المركز'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'إجمالي الطلاب', value: stats.students, icon: Users2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'إجمالي المعلمين', value: stats.teachers, icon: UserSquare2, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'المراحل الدراسية', value: stats.grades, icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'المواعيد الأسبوعية', value: stats.schedules, icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((item, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={item.label}
          >
            <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">{item.label}</p>
                  <h3 className="text-3xl font-black text-gray-900">{item.value}</h3>
                </div>
                <div className={cn('p-3 rounded-2xl', item.bg, item.color)}>
                  <item.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs text-emerald-600 font-bold">
                <TrendingUp className="w-3 h-3" />
                <span>+5% منذ الشهر الماضي</span>
              </div>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              توزيع البيانات
            </h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>نشط</span>
              </div>
            </div>
          </div>
          <div className="h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              أحدث المواعيد
            </h3>
            <a href="/schedules" className="text-xs text-blue-600 font-bold hover:underline">عرض الكل</a>
          </div>
          <div className="space-y-4">
            {recentSchedules.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-sm">لا توجد مواعيد مضافة</div>
            ) : (
              recentSchedules.map((schedule) => (
                <div key={schedule.id} className={cn(
                  "flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100",
                  schedule.isExam && "bg-red-50/50 border-red-100"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    schedule.isExam ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {schedule.isExam ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{schedule.subject}</h4>
                      {schedule.isExam && <span className="text-[8px] bg-red-600 text-white px-1 rounded">امتحان</span>}
                    </div>
                    <p className="text-xs text-gray-500">{formatTime12h(schedule.startTime)} - {schedule.endTime ? formatTime12h(schedule.endTime) : '--:--'}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300" />
                </div>
              ))
            )}
          </div>
          <div className="mt-8 pt-8 border-t border-gray-100">
            <div className="bg-blue-600 rounded-2xl p-6 text-white relative overflow-hidden">
              <h4 className="font-bold mb-1 relative z-10">تحتاج مساعدة؟</h4>
              <p className="text-xs text-blue-100 mb-4 relative z-10">تواصل مع الدعم الفني للحصول على المساعدة</p>
              <Button variant="outline" className="w-full text-xs h-10 border-white/30 bg-white/10 hover:bg-white/20 text-white relative z-10">تواصل معنا</Button>
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
