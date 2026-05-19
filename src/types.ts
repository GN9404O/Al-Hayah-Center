export interface AppSettings {
  id: string;
  systemName: string;
  systemDescription?: string;
  whatsappNumber?: string;
  whatsappCountryCode?: string;
  alertsEnabled?: boolean;
  alertsContent?: string;
  updatedAt: any;
}

export interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'staff' | 'student' | 'teacher';
  createdAt: any;
}

export interface Grade {
  id: string;
  name: string;
  createdAt: any;
}

export interface Teacher {
  id: string;
  name: string;
  email?: string;
  phone: string;
  subject: string;
  photoURL?: string;
  gradeIds: string[];
  notes?: string;
  bio?: string;
  experience?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  userId?: string;
  createdAt: any;
}

export interface Group {
  id: string;
  name: string;
  gradeId: string;
  subject: string;
  teacherId: string;
  capacity?: number;
  createdAt: any;
}

export interface Schedule {
  id: string;
  gradeId: string;
  groupId: string;
  teacherId: string;
  subject: string;
  day: 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  startTime: string;
  endTime?: string;
  isExam?: boolean;
  room: string;
  notes?: string;
  createdAt: any;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  phone: string;
  parentPhone: string;
  gradeId: string;
  groupId: string;
  notes?: string;
  createdAt: any;
}

export interface GroupSession {
  id: string;
  groupId: string;
  date: string;
  records: {
    studentId: string;
    studentName: string;
    attended: boolean;
    amountPaid: number;
  }[];
  createdAt: any;
}
