import React, { createContext, useContext, ReactNode } from 'react';
import { useStudentStore, Student } from '@/hooks/useStudentStore';

interface StudentContextType {
  students: Student[];
  addStudent: (name: string) => void;
  removeStudent: (id: string) => void;
  updateStudent: (id: string, name: string) => void;
  clearAll: () => void;
  importFromText: (text: string) => void;
}

const StudentContext = createContext<StudentContextType | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const store = useStudentStore();
  return <StudentContext.Provider value={store}>{children}</StudentContext.Provider>;
}

export function useStudents() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudents must be used within StudentProvider');
  return ctx;
}
