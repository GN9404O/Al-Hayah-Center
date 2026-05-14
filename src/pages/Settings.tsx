import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Card, Button, Input, cn } from '../components/ui';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User as UserIcon, Shield, Bell, Lock, Globe, Settings as SettingsIcon, Search, Trash2, ShieldAlert, Check, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export function Settings() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [systemName, setSystemName] = useState(settings?.systemName || '');
  const [systemDescription, setSystemDescription] = useState(settings?.systemDescription || '');
  const [whatsappNumber, setWhatsappNumber] = useState(settings?.whatsappNumber || '');
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(settings?.whatsappCountryCode || '+20');
  const [loading, setLoading] = useState(false);
  const [systemLoading, setSystemLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'system' | 'admins' | 'security'>('profile');

  const [alertsEnabled, setAlertsEnabled] = useState(settings?.alertsEnabled || false);
  const [alertsContent, setAlertsContent] = useState(settings?.alertsContent || '');

  const [adminEmails, setAdminEmails] = useState<{id: string, email: string, name: string}[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const [teacherProfiles, setTeacherProfiles] = useState<{id: string, name: string}[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<{id: string, email: string, name: string, userId?: string}[]>([]);
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [isTeacherLoading, setIsTeacherLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [searchingUser, setSearchingUser] = useState<{uid: string, name: string} | null>(null);

  const SUPER_ADMIN_EMAIL = 'canva40478@gmail.com';
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  useEffect(() => {
    if (settings) {
      setSystemName(settings.systemName || '');
      setSystemDescription(settings.systemDescription || '');
      setWhatsappNumber(settings.whatsappNumber || '');
      setWhatsappCountryCode(settings.whatsappCountryCode || '+20');
      setAlertsEnabled(settings.alertsEnabled || false);
      setAlertsContent(settings.alertsContent || '');
    }
  }, [settings]);

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'admins') {
      const q = query(collection(db, 'users'), where('role', '==', 'admin'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAdminEmails(snapshot.docs
          .map(doc => ({ id: doc.id, email: doc.data().email, name: doc.data().displayName }))
          .filter(admin => admin.email !== SUPER_ADMIN_EMAIL)
        );
      });
      return () => unsubscribe();
    }
    
    if (activeTab === 'teachers' && (isSuperAdmin || user?.role === 'admin')) {
      const q = query(collection(db, 'teachers'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          email: doc.data().email || '', 
          name: doc.data().name,
          userId: doc.data().userId
        }));
        
        // Only show teachers who have an email set in the linked accounts list
        setLinkedAccounts(allData.filter(t => t.email && t.email !== ''));
        
        // All profiles for the selection dropdown
        setTeacherProfiles(allData.map(t => ({ id: t.id, name: t.name })));
      });
      return () => unsubscribe();
    }
  }, [isSuperAdmin, activeTab, user]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !isSuperAdmin) return;
    
    setIsAdminLoading(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', newAdminEmail.trim().toLowerCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.error('لم يتم العثور على مستخدم بهذا البريد الإلكتروني. يجب أن يكون قد سجل دخوله للنظام مرة واحدة على الأقل بالبريد الذي أدخلته.');
        return;
      }

      const userDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        role: 'admin',
        updatedAt: serverTimestamp()
      });
      
      toast.success('تمت إضافة المشرف بنجاح');
      setNewAdminEmail('');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إضافة المشرف');
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (!isSuperAdmin) return;
    
    if (!confirm('هل أنت متأكد من سحب صلاحيات الإشراف من هذا المستخدم؟')) return;

    try {
      await updateDoc(doc(db, 'users', adminId), {
        role: 'student',
        updatedAt: serverTimestamp()
      });
      toast.success('تم سحب صلاحيات الإشراف');
    } catch (error) {
      toast.error('حدث خطأ أثناء سحب الصلاحيات');
    }
  };

  const handleSearchUserForTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newTeacherEmail.trim().toLowerCase();
    if (!email) return;
    
    setIsTeacherLoading(true);
    try {
      const userQuery = query(collection(db, 'users'), where('email', '==', email));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        toast.error('لم يتم العثور على مستخدم بهذا البريد الإلكتروني. يجب أن يكون قد سجل دخوله للنظام مرة واحدة على الأقل.');
        setSearchingUser(null);
        return;
      }

      const foundUser = userSnapshot.docs[0];
      setSearchingUser({
        uid: foundUser.id,
        name: foundUser.data().displayName || 'مستخدم جديد'
      });
      toast.success('تم العثور على المستخدم، يرجى اختيار ملف المعلم لربطه به');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء البحث عن المستخدم');
    } finally {
      setIsTeacherLoading(false);
    }
  };

  const handleLinkTeacherEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchingUser || !selectedProfileId) {
      toast.error('يرجى اختيار ملف معلم للربط');
      return;
    }
    
    setIsTeacherLoading(true);
    try {
      // 1. Update user role
      await updateDoc(doc(db, 'users', searchingUser.uid), {
        role: 'teacher',
        updatedAt: serverTimestamp()
      });
      
      // 2. Link in teacher doc
      await updateDoc(doc(db, 'teachers', selectedProfileId), {
        userId: searchingUser.uid,
        email: newTeacherEmail.trim().toLowerCase()
      });

      toast.success('تم ربط حساب المعلم بالملف الشخصي بنجاح.');
      setNewTeacherEmail('');
      setSearchingUser(null);
      setSelectedProfileId('');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء ربط الحساب');
    } finally {
      setIsTeacherLoading(false);
    }
  };

  const handleUnlinkTeacher = async (teacherId: string, userId: string | undefined) => {
    if (!confirm('هل أنت متأكد من إلغاء ربط هذا الحساب؟ سيفقد المستخدم صلاحيات المعلم.')) return;

    try {
      if (userId) {
        await updateDoc(doc(db, 'users', userId), {
          role: 'student',
          updatedAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'teachers', teacherId), {
        userId: null,
        email: null
      });

      toast.success('تم إلغاء ربط الحساب بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إلغاء الربط');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName
      });
      toast.success('تم تحديث الملف الشخصي بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء التحديث');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemLoading(true);
    try {
      await updateDoc(doc(db, 'settings', 'app_config'), {
        systemName,
        systemDescription,
        whatsappNumber,
        whatsappCountryCode,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث إعدادات النظام بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث النظام');
    } finally {
      setSystemLoading(false);
    }
  };

  const handleUpdateAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertsLoading(true);
    try {
      await updateDoc(doc(db, 'settings', 'app_config'), {
        alertsEnabled,
        alertsContent,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث التنبيهات بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث التنبيهات');
    } finally {
      setAlertsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900">الإعدادات</h1>
        <p className="text-gray-500">إدارة حسابك وتفضيلات النظام</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4">
          <nav className="space-y-1">
            {[
              { id: 'profile', label: 'الملف الشخصي', icon: UserIcon },
              { id: 'system', label: 'إعدادات النظام', icon: SettingsIcon },
              { id: 'admins', label: 'إدارة المشرفين', icon: Shield, hidden: !isSuperAdmin },
              { id: 'teachers', label: 'حسابات المعلمين', icon: UserIcon, hidden: !isSuperAdmin && user?.role !== 'admin' },
              { id: 'security', label: 'التنبيهات الهامة', icon: Bell },
              { id: 'notifications', label: 'الإشعارات', icon: Bell, disabled: true, hidden: true },
              { id: 'language', label: 'اللغة', icon: Globe, disabled: true, hidden: true },
            ].filter(i => !i.hidden).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={(item as any).disabled}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                    : "text-gray-500 hover:bg-white hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="md:col-span-2 space-y-6">
          {activeTab === 'profile' && (
            <Card className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6">المعلومات الشخصية</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative group">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-xl" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-blue-600 border-4 border-white shadow-xl">
                        {user?.displayName?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{user?.displayName}</h4>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="الاسم المعروض" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    required 
                  />
                  <Input 
                    label="البريد الإلكتروني" 
                    value={user?.email || ''} 
                    disabled 
                    className="bg-gray-50"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={loading} className="px-8 rounded-xl h-12">
                    {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'system' && (
            <Card className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6">إعدادات النظام</h3>
              <form onSubmit={handleUpdateSystem} className="space-y-6">
                <Input 
                  label="اسم المركز / النظام" 
                  value={systemName} 
                  onChange={(e) => setSystemName(e.target.value)} 
                  required 
                />
                <Input 
                  label="وصف النظام" 
                  value={systemDescription} 
                  onChange={(e) => setSystemDescription(e.target.value)} 
                />
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2">
                    <label className="text-sm font-bold text-gray-700">رقم الواتساب (للحجز)</label>
                    <div className="flex gap-2">
                      <select
                        value={whatsappCountryCode}
                        onChange={(e) => setWhatsappCountryCode(e.target.value)}
                        className="w-24 h-12 bg-gray-50 border-none rounded-xl px-2 focus:ring-2 focus:ring-blue-600 font-bold text-center appearance-none cursor-pointer"
                      >
                        <option value="+20">🇪🇬 +20</option>
                        <option value="+966">🇸🇦 +966</option>
                        <option value="+971">🇦🇪 +971</option>
                        <option value="+965">🇰🇼 +965</option>
                        <option value="+974">🇶🇦 +974</option>
                        <option value="+968">🇴🇲 +968</option>
                        <option value="+962">🇯🇴 +962</option>
                        <option value="+212">🇲🇦 +212</option>
                      </select>
                      <div className="flex-1">
                        <Input
                          placeholder="مثال: 01012345678"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          className="h-12 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={systemLoading} className="px-8 rounded-xl h-12">
                    {systemLoading ? 'جاري الحفظ...' : 'حفظ إعدادات النظام'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">تنبيهات المنصة الهامة</h3>
                  <p className="text-sm text-gray-500">إظهار رسائل تحذيرية أو تنبيهات لجميع الطلاب</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    alertsEnabled ? "bg-red-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      alertsEnabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <form onSubmit={handleUpdateAlerts} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">محتوى التنبيه (يدعم النص البسيط)</label>
                  <textarea
                    rows={5}
                    value={alertsContent}
                    onChange={(e) => setAlertsContent(e.target.value)}
                    placeholder="مثال: نعتذر عن البدء المتأخر اليوم للمحاضرة الثالثة ثانوي لتكون الساعة 5:30 بدلاً من 4:00"
                    className="w-full bg-gray-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-red-600 font-medium text-sm text-red-900 placeholder:text-gray-400"
                  />
                </div>

                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-800">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    عند تفعيل هذا الخيار، سيظهر التنبيه في أعلى لوحة تحكم الطالب بشكل بارز جداً. 
                    يرجى التأكد من كتابة معلومات دقيقة وواضحة.
                  </p>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={alertsLoading} className="px-8 rounded-xl h-12 bg-red-600 hover:bg-red-700">
                    {alertsLoading ? 'جاري الحفظ...' : 'حفظ ونشر التنبيه'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'admins' && isSuperAdmin && (
            <div className="space-y-6">
              <Card className="p-8 border-2 border-dashed border-blue-200 bg-blue-50/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">إضافة مشرف جديد</h3>
                    <p className="text-sm text-gray-500">قم بإدخال البريد الإلكتروني للمستخدم لترقيته لمشرف</p>
                  </div>
                </div>
                
                <form onSubmit={handleAddAdmin} className="flex gap-4">
                  <div className="flex-1">
                    <Input 
                      placeholder="example@gmail.com" 
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      type="email"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <Button type="submit" disabled={isAdminLoading || !newAdminEmail} className="px-6 rounded-xl h-12 bg-blue-600 hover:bg-blue-700">
                    {isAdminLoading ? 'جاري التحقق...' : 'إضافة'}
                  </Button>
                </form>
              </Card>

              <Card className="p-0 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">قائمة المشرفين</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {adminEmails.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      لا يوجد مشرفون حالياً غيرك
                    </div>
                  ) : (
                    adminEmails.map((admin) => (
                      <div key={admin.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                            {admin.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{admin.name || 'مستخدم غير معروف'}</p>
                            <p className="text-sm text-gray-500">{admin.email}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleRemoveAdmin(admin.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 p-2 h-auto rounded-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-3 text-orange-800">
                <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">
                  ملاحظة أمنية: لا يمكن سحب الصلاحيات من بريدك الإلكتروني الشخصي ({SUPER_ADMIN_EMAIL}) لأنه البريد الأساسي للنظام.
                  فقط البريد الإلكتروني الذي يبدأ به النظام هو من يملك صلاحية إدارة المشرفين الآخرين.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'teachers' && (isSuperAdmin || user?.role === 'admin') && (
            <div className="space-y-6">
              <Card className="p-8 border-2 border-dashed border-green-200 bg-green-50/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">ربط مستخدم بملف معلم</h3>
                    <p className="text-sm text-gray-500">اربط بريداً إلكترونياً مسجلاً بملف معلم من صفحة المعلمين</p>
                  </div>
                </div>
                
                <form onSubmit={searchingUser ? handleLinkTeacherEmail : handleSearchUserForTeacher} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input 
                        placeholder="بريد المستخدم المسجل (example@gmail.com)" 
                        value={newTeacherEmail}
                        onChange={(e) => {
                          setNewTeacherEmail(e.target.value);
                          setSearchingUser(null);
                        }}
                        type="email"
                        disabled={!!searchingUser}
                        className="h-12 rounded-xl focus:ring-green-600"
                      />
                    </div>
                    {!searchingUser && (
                      <Button type="submit" disabled={isTeacherLoading || !newTeacherEmail} className="px-6 rounded-xl h-12 bg-green-600 hover:bg-green-700">
                        {isTeacherLoading ? 'جاري البحث...' : 'بحث عن مستخدم'}
                      </Button>
                    )}
                  </div>

                  {searchingUser && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-4 bg-white border border-green-100 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-xs">
                            {searchingUser.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{searchingUser.name}</p>
                            <p className="text-xs text-gray-500">{newTeacherEmail}</p>
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={() => {
                            setSearchingUser(null);
                            setNewTeacherEmail('');
                          }}
                          className="text-xs text-red-500 hover:bg-red-50 h-8"
                        >
                          تغيير المستخدم
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">اختر الملف الشخصي للمعلم للربط</label>
                        <select
                          value={selectedProfileId}
                          onChange={(e) => setSelectedProfileId(e.target.value)}
                          className="w-full h-12 bg-white border border-gray-200 rounded-xl px-4 focus:ring-2 focus:ring-green-600 font-bold"
                          required
                        >
                          <option value="">-- اختر ملف المعلم --</option>
                          {teacherProfiles
                            .map(profile => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))
                          }
                        </select>
                      </div>

                      <Button 
                        type="submit" 
                        disabled={isTeacherLoading || !selectedProfileId} 
                        className="w-full rounded-xl h-12 bg-green-600 hover:bg-green-700 text-lg font-black shadow-lg shadow-green-100"
                      >
                        {isTeacherLoading ? 'جاري الربط...' : 'إتمام عملية الربط الآن'}
                      </Button>
                    </div>
                  )}
                </form>
              </Card>

              <Card className="p-0 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">المعلمون وحساباتهم المرتبطة</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {linkedAccounts.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 font-medium">
                      لا يوجد حسابات معلمي مرتبطة حالياً. استخدم النموذج أعلاه لربط حساب جديد.
                    </div>
                  ) : (
                    linkedAccounts.map((teacher) => (
                      <div key={teacher.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center font-bold">
                            {teacher.name?.charAt(0) || 'T'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900">{teacher.name}</p>
                              {teacher.userId ? (
                                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-full border border-green-100 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" />
                                  مرتبط
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 text-[10px] font-bold rounded-full border border-yellow-100 italic">
                                  بانتظار التسجيل
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {teacher.email ? (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-blue-500" />
                                  {teacher.email}
                                </span>
                              ) : (
                                <span className="text-red-400 italic">لا يوجد بريد إلكتروني</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleUnlinkTeacher(teacher.id, teacher.userId)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 p-2 h-auto rounded-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
