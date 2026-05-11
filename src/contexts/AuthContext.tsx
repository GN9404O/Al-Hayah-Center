import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
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
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (firebaseUser) {
        unsubscribeUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
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

            // Auto-detect teacher by email or userId link
            if (firebaseUser.email) {
              try {
                const emailLower = firebaseUser.email.toLowerCase().trim();
                
                // 1. Check if this UID is linked to ANY teacher document
                const qUserId = query(collection(db, 'teachers'), where('userId', '==', firebaseUser.uid));
                const teacherSnapshotUserId = await getDocs(qUserId);
                
                // 2. Check if this EMAIL is linked to ANY teacher document
                const qByEmail = query(collection(db, 'teachers'), where('email', '==', emailLower));
                const teacherSnapshotByEmail = await getDocs(qByEmail);

                if (!teacherSnapshotUserId.empty || !teacherSnapshotByEmail.empty) {
                  const teacherDoc = !teacherSnapshotUserId.empty ? teacherSnapshotUserId.docs[0] : teacherSnapshotByEmail.docs[0];
                  
                  // If we found a teacher match, but the user role is still student, upgrade it
                  if (currentUserRole !== 'teacher' && currentUserRole !== 'admin') {
                    currentUserRole = 'teacher';
                    // We don't await here to avoid blocking snapshot unnecessarily, but role is updated locally
                    updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'teacher' }).catch(console.error);
                  }
                  
                  // Ensure teacher doc is linked to this UID
                  if (teacherDoc.data().userId !== firebaseUser.uid) {
                    updateDoc(doc(db, 'teachers', teacherDoc.id), { userId: firebaseUser.uid }).catch(console.error);
                  }
                }
              } catch (e) {
                console.error("Error auto-detecting teacher role:", e);
              }
            }

            // Sync with students collection if role is student
            if (currentUserRole === 'student') {
              const studentDocRef = doc(db, 'students', firebaseUser.uid);
              const studentDoc = await getDoc(studentDocRef);
              
              const studentData = {
                name: firebaseUser.displayName || 'طالب جديد',
                email: firebaseUser.email || '',
                updatedAt: serverTimestamp(),
              };

              if (!studentDoc.exists()) {
                await setDoc(studentDocRef, {
                  ...studentData,
                  phone: '',
                  parentPhone: '',
                  gradeId: localStorage.getItem('edu_center_grade_id') || '',
                  groupId: '',
                  createdAt: serverTimestamp(),
                });
              } else {
                const existingData = studentDoc.data();
                if (existingData.name !== studentData.name || existingData.email !== studentData.email) {
                  await updateDoc(studentDocRef, studentData);
                }
              }
            } else {
              // Delete from students collection if role is not student
              try {
                const studentDoc = await getDoc(doc(db, 'students', firebaseUser.uid));
                if (studentDoc.exists()) {
                  await deleteDoc(doc(db, 'students', firebaseUser.uid));
                }
              } catch (e) {
                // Ignore
              }
            }

            setUser({ id: userDoc.id, ...userData, role: currentUserRole } as User);
          } else {
            // Create new user profile
            const isAdmin = firebaseUser.email?.toLowerCase() === 'canva40478@gmail.com';
            let initialRole = isAdmin ? 'admin' : 'student';
            
            // Check if email belongs to a teacher or userId is linked
            if (!isAdmin && firebaseUser.email) {
              try {
                const emailLower = firebaseUser.email.toLowerCase().trim();
                const qByEmail = query(collection(db, 'teachers'), where('email', '==', emailLower));
                const teacherSnapshot = await getDocs(qByEmail);
                
                if (!teacherSnapshot.empty) {
                  initialRole = 'teacher';
                  const teacherDoc = teacherSnapshot.docs[0];
                  await updateDoc(doc(db, 'teachers', teacherDoc.id), { userId: firebaseUser.uid });
                }
              } catch (e) {
                console.error("Error checking for teacher during registration:", e);
              }
            }

            const newUser: Partial<User> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              role: initialRole as any,
              createdAt: serverTimestamp(),
            };
            
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              
              if (initialRole === 'student') {
                const pendingGradeId = localStorage.getItem('pending_grade_id');
                await setDoc(doc(db, 'students', firebaseUser.uid), {
                  name: firebaseUser.displayName || 'طالب جديد',
                  email: firebaseUser.email || '',
                  phone: '',
                  parentPhone: '',
                  gradeId: pendingGradeId || '',
                  groupId: '',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                
                if (pendingGradeId) {
                  localStorage.removeItem('pending_grade_id');
                  localStorage.setItem('edu_center_grade_id', pendingGradeId);
                }
              }
            } catch (e) {
              handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
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
