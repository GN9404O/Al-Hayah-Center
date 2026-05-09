export const ACADEMIC_STAGES = [
  {
    id: 'kindergarten',
    name: 'رياض الأطفال',
    grades: [
      { id: 'kg1', name: 'كي جي 1' },
      { id: 'kg2', name: 'كي جي 2' },
    ]
  },
  {
    id: 'primary',
    name: 'المرحلة الابتدائية',
    grades: [
      { id: 'p1', name: 'الصف الأول الابتدائي' },
      { id: 'p2', name: 'الصف الثاني الابتدائي' },
      { id: 'p3', name: 'الصف الثالث الابتدائي' },
      { id: 'p4', name: 'الصف الرابع الابتدائي' },
      { id: 'p5', name: 'الصف الخامس الابتدائي' },
      { id: 'p6', name: 'الصف السادس الابتدائي' },
    ]
  },
  {
    id: 'preparatory',
    name: 'المرحلة الإعدادية',
    grades: [
      { id: 'm1', name: 'الصف الأول الإعدادي' },
      { id: 'm2', name: 'الصف الثاني الإعدادي' },
      { id: 'm3', name: 'الصف الثالث الإعدادي' },
    ]
  },
  {
    id: 'secondary',
    name: 'المرحلة الثانوية',
    grades: [
      { id: 's1', name: 'الصف الأول الثانوي' },
      { id: 's2', name: 'الصف الثاني الثانوي' },
      { id: 's3', name: 'الصف الثالث الثانوي' },
    ]
  }
];

export const getGradeNameById = (gradeId: string, customGrades: any[] = []) => {
  for (const stage of ACADEMIC_STAGES) {
    const grade = stage.grades.find(g => g.id === gradeId);
    if (grade) return grade.name;
  }
  return customGrades.find(g => g.id === gradeId)?.name || gradeId || '-';
};
