import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';
import type { QuizPaper } from './quizTypes';
import { createQuizPaperDocxBuffer } from './quizPaperExport';

const labels = {
  single: '单选',
  multi: '多选',
  tf: '判断',
  short: '简答',
  totalScore: '总分',
  points: '分',
  answer: '答案',
  explanation: '解析',
  questionsUnit: '题',
};

const samplePaper: QuizPaper = {
  id: 'paper-1',
  user_id: 'local',
  title: '生物单元测验',
  description: '用于验证 DOCX 导出',
  questions: [
    {
      question_id: 'q1',
      score: 5,
      order: 0,
      question: {
        id: 'q1',
        user_id: 'local',
        type: 'single',
        content: '光合作用主要发生在哪里？',
        options: ['A. 叶绿体', 'B. 线粒体', 'C. 细胞膜', 'D. 液泡'],
        correct_answer: 'A',
        tags: 'biology',
        created_at: new Date().toISOString(),
        explanation: '叶绿体中含有叶绿素，是光合作用的主要场所。',
      } as any,
    },
  ],
  template: null,
  total_score: 5,
  is_template: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

async function getDocumentXml(includeAnswers: boolean) {
  const arrayBuffer = await createQuizPaperDocxBuffer(samplePaper, includeAnswers, labels);
  const zip = await JSZip.loadAsync(arrayBuffer);
  return zip.file('word/document.xml')?.async('text');
}

describe('quizPaperExport docx', () => {
  it('omits answer and explanation when includeAnswers is false', async () => {
    const xml = await getDocumentXml(false);

    expect(xml).toContain('生物单元测验');
    expect(xml).toContain('光合作用主要发生在哪里');
    expect(xml).not.toContain('答案：');
    expect(xml).not.toContain('解析：');
  });

  it('includes answer and explanation when includeAnswers is true', async () => {
    const xml = await getDocumentXml(true);

    expect(xml).toContain('答案：');
    expect(xml).toContain('A');
    expect(xml).toContain('解析：');
    expect(xml).toContain('叶绿体中含有叶绿素');
  });
});