import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Card, Button, Input } from '../components/ui';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Shield, Bell, Lock, Globe, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export function Settings() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [systemName, setSystemName] = useState(settings?.systemName || '');
  const [systemDescription, setSystemDescription] = useState(settings?.systemDescription || '');
  const [whatsappNumber, setWhatsappNumber] = useState(settings?.whatsappNumber || '');
  const [loading, setLoading] = useState(false);
  const [systemLoading, setSystemLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'system'>('profile');

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
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث إعدادات النظام بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث النظام');
    } finally {
      setSystemLoading(false);
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
              { id: 'profile', label: 'الملف الشخصي', icon: User },
              { id: 'system', label: 'إعدادات النظام', icon: SettingsIcon },
              { id: 'security', label: 'الأمان', icon: Shield, disabled: true },
              { id: 'notifications', label: 'الإشعارات', icon: Bell, disabled: true },
              { id: 'language', label: 'اللغة', icon: Globe, disabled: true },
            ].map((item) => (
              <button
                key={item.id}
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
                <Input 
                  label="رقم الواتساب (للحجز)" 
                  value={whatsappNumber} 
                  placeholder="مثال: 01012345678"
                  onChange={(e) => setWhatsappNumber(e.target.value)} 
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={systemLoading} className="px-8 rounded-xl h-12">
                    {systemLoading ? 'جاري الحفظ...' : 'حفظ إعدادات النظام'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { cn } from '../components/ui';
