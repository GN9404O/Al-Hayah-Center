import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Check if user exists in Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            let currentUserRole = userData.role;

            // Force admin role if email matches
            if (firebaseUser.email === 'canva40478@gmail.com' && userData.role !== 'admin') {
              currentUserRole = 'admin';
              try {
                await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
              } catch (e) {
                console.error("Failed to update admin role:", e);
              }
            }

            // If the user's role is student, ensure they have a record in the students collection
            if (currentUserRole === 'student') {
              const studentDoc = await getDoc(doc(db, 'students', firebaseUser.uid));
              if (!studentDoc.exists()) {
                await setDoc(doc(db, 'students', firebaseUser.uid), {
                  name: firebaseUser.displayName || 'طالب جديد',
                  email: firebaseUser.email || '',
                  phone: '',
                  parentPhone: '',
                  gradeId: localStorage.getItem('edu_center_grade_id') || '',
                  groupId: '',
                  createdAt: serverTimestamp(),
                });
              }
            } else {
              // If they are admin or teacher, make sure they are NOT in the students collection
              // This addresses "hide moderators from student list"
              try {
                const studentDoc = await getDoc(doc(db, 'students', firebaseUser.uid));
                if (studentDoc.exists()) {
                  await deleteDoc(doc(db, 'students', firebaseUser.uid));
                }
              } catch (e) {
                // Ignore errors here
              }
            }

            setUser({ id: userDoc.id, ...userData, role: currentUserRole } as User);
          } else {
            // Create new user profile
            const isAdmin = firebaseUser.email === 'canva40478@gmail.com';
            const newUser: Partial<User> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              role: isAdmin ? 'admin' : 'student',
              createdAt: serverTimestamp(),
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              
              // If the new user is a student, also add them to the students collection
              if (newUser.role === 'student') {
                const pendingGradeId = localStorage.getItem('pending_grade_id');
                await setDoc(doc(db, 'students', firebaseUser.uid), {
                  name: firebaseUser.displayName || 'طالب جديد',
                  email: firebaseUser.email || '',
                  phone: '',
                  parentPhone: '',
                  gradeId: pendingGradeId || '',
                  groupId: '',
                  createdAt: serverTimestamp(),
                });
                
                if (pendingGradeId) {
                  localStorage.removeItem('pending_grade_id');
                  localStorage.setItem('edu_center_grade_id', pendingGradeId);
                }
              }
              
              setUser({ id: firebaseUser.uid, ...newUser } as User);
            } catch (e) {
              handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
          }
        } catch (error) {
          console.error("Error loading user profile:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    if (loginLoading) return;
    
    setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Ensure we don't have multiple popups
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup was closed or cancelled.');
        return;
      }
      if (error.message.includes('Pending promise was never set')) {
        console.warn('Suppressing Firebase auth internal assertion error');
        return;
      }
      console.error('Login error:', error);
      
      // Provide more helpful error message for users on custom domains
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('هذا النطاق (Domain) غير مصرح له بتسجيل الدخول في Firebase. يرجى إضافته في إعدادات Authentication.');
      } else {
        toast.error('حدث خطأ أثناء تسجيل الدخول: ' + (error.message || 'خطأ غير معروف'));
      }
      
      throw error;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading: loading || loginLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
