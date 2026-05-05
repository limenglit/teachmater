import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from 'docx';
import type { QuizPaper, PaperQuestion, QuizQuestion } from './quizTypes';
import { normalizeQuizOptionText } from '@/lib/quiz-utils';
import { writeExcelFile } from '@/lib/excel-utils';
import { exportToPDF } from '@/lib/export';

export type QuizPaperExportFormat = 'xlsx' | 'pdf' | 'docx';

export interface QuizPaperExportLabels {
  single: string;
  multi: string;
  tf: string;
  short: string;
  totalScore: string;
  points: string;
  answer: string;
  explanation: string;
  questionsUnit: string;
}

interface ExportQuizPaperOptions {
  format: QuizPaperExportFormat;
  includeAnswers: boolean;
  labels: QuizPaperExportLabels;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_FONT = 'Microsoft YaHei';

export function formatQuizPaperAnswer(question: QuizQuestion): string {
  if (question.type === 'tf') {
    const value = String(question.correct_answer);
    return value === 'true' || value === 'T' || value === '1' ? '✓' : '✗';
  }

  if (Array.isArray(question.correct_answer)) {
    return question.correct_answer.join(', ');
  }

  return String(question.correct_answer ?? '');
}

export function getQuizPaperQuestionTypeLabel(type: string, labels: QuizPaperExportLabels): string {
  return type === 'single'
    ? labels.single
    : type === 'multi'
      ? labels.multi
      : type === 'tf'
        ? labels.tf
        : labels.short;
}

export function getQuizPaperExportRows(paper: QuizPaper, includeAnswers: boolean, labels: QuizPaperExportLabels) {
  const questions = paper.questions as PaperQuestion[];
  return questions.map((paperQuestion, index) => {
    const explanation = ((paperQuestion.question as any).explanation as string | undefined)?.trim() || '';
    const baseRow = [
      index + 1,
      getQuizPaperQuestionTypeLabel(paperQuestion.question.type, labels),
      paperQuestion.question.content,
      ...(['A', 'B', 'C', 'D'].map((_, optionIndex) => normalizeQuizOptionText(paperQuestion.question.options[optionIndex] || '', optionIndex))),
      paperQuestion.score,
    ];

    if (!includeAnswers) {
      return baseRow;
    }

    return [
      ...baseRow,
      formatQuizPaperAnswer(paperQuestion.question),
      explanation,
    ];
  });
}

export function createQuizPaperExportContainer(
  paper: QuizPaper,
  includeAnswers: boolean,
  labels: QuizPaperExportLabels,
  options?: { includeTitle?: boolean },
) {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = '820px';
  host.style.padding = '0';
  host.style.background = '#ffffff';

  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';
  container.style.background = '#ffffff';
  container.style.color = '#111827';
  container.style.fontFamily = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  container.style.padding = '8px 16px 24px';

  if (options?.includeTitle !== false) {
    const title = document.createElement('h1');
    title.style.fontSize = '24px';
    title.style.fontWeight = '700';
    title.style.textAlign = 'center';
    title.style.margin = '0 0 8px';
    title.textContent = paper.title;
    container.appendChild(title);
  }

  if (paper.description) {
    const description = document.createElement('p');
    description.style.margin = '0 0 12px';
    description.style.fontSize = '14px';
    description.style.lineHeight = '1.7';
    description.style.whiteSpace = 'pre-wrap';
    description.textContent = paper.description;
    container.appendChild(description);
  }

  const meta = document.createElement('div');
  meta.style.display = 'flex';
  meta.style.justifyContent = 'space-between';
  meta.style.alignItems = 'center';
  meta.style.marginBottom = '16px';
  meta.style.paddingBottom = '8px';
  meta.style.borderBottom = '1px solid #e5e7eb';
  meta.style.fontSize = '14px';

  const count = document.createElement('span');
  count.textContent = `${paper.questions.length} ${labels.questionsUnit}`;
  const totalScore = document.createElement('span');
  totalScore.textContent = `${labels.totalScore}: ${paper.total_score}`;
  meta.append(count, totalScore);
  container.appendChild(meta);

  (paper.questions as PaperQuestion[]).forEach((paperQuestion, index) => {
    const card = document.createElement('div');
    card.style.padding = '0 0 14px';
    card.style.marginBottom = '14px';
    card.style.borderBottom = '1px dashed #d1d5db';
    card.style.breakInside = 'avoid';
    (card.style as CSSStyleDeclaration & { pageBreakInside?: string }).pageBreakInside = 'avoid';

    const questionTitle = document.createElement('div');
    questionTitle.style.fontSize = '16px';
    questionTitle.style.lineHeight = '1.7';
    questionTitle.style.fontWeight = '600';
    questionTitle.style.whiteSpace = 'pre-wrap';
    questionTitle.textContent = `${index + 1}. (${paperQuestion.score}${labels.points}) ${paperQuestion.question.content}`;
    card.appendChild(questionTitle);

    if (paperQuestion.question.options.length > 0) {
      const options = document.createElement('div');
      options.style.marginTop = '10px';
      options.style.paddingLeft = '8px';
      options.style.display = 'grid';
      options.style.gap = '8px';

      paperQuestion.question.options.forEach((optionText, optionIndex) => {
        const option = document.createElement('div');
        option.style.fontSize = '14px';
        option.style.lineHeight = '1.7';
        option.style.whiteSpace = 'pre-wrap';
        option.textContent = `${String.fromCharCode(65 + optionIndex)}. ${normalizeQuizOptionText(optionText, optionIndex)}`;
        options.appendChild(option);
      });

      card.appendChild(options);
    }

    if (includeAnswers) {
      const answer = document.createElement('div');
      answer.style.marginTop = '10px';
      answer.style.fontSize = '13px';
      answer.style.lineHeight = '1.7';
      answer.textContent = `${labels.answer}：${formatQuizPaperAnswer(paperQuestion.question) || '—'}`;
      card.appendChild(answer);

      const explanation = ((paperQuestion.question as any).explanation as string | undefined)?.trim();
      if (explanation) {
        const explanationBlock = document.createElement('div');
        explanationBlock.style.marginTop = '6px';
        explanationBlock.style.fontSize = '13px';
        explanationBlock.style.lineHeight = '1.7';
        explanationBlock.style.whiteSpace = 'pre-wrap';
        explanationBlock.textContent = `${labels.explanation}：${explanation}`;
        card.appendChild(explanationBlock);
      }
    }

    container.appendChild(card);
  });

  host.appendChild(container);
  return { host, container };
}

function createMultilineTextRuns(text: string, options?: Record<string, unknown>) {
  const lines = (text || '').split(/\r?\n/);
  return lines.map((line, index) => new TextRun({
    ...(options || {}),
    text: line || ' ',
    break: index === 0 ? undefined : 1,
  } as any));
}

function createParagraph(options: Omit<IParagraphOptions, 'children'> & { text: string; prefix?: string; boldPrefix?: boolean }) {
  const { text, prefix, boldPrefix, ...paragraphOptions } = options;
  const children: TextRun[] = [];

  if (prefix) {
    children.push(new TextRun({ text: prefix, bold: boldPrefix }));
  }

  children.push(...createMultilineTextRuns(text));

  return new Paragraph({
    ...paragraphOptions,
    children,
  });
}

export async function createQuizPaperDocxBuffer(paper: QuizPaper, includeAnswers: boolean, labels: QuizPaperExportLabels) {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: paper.title, bold: true, size: 34, font: DOCX_FONT })],
    }),
  ];

  if (paper.description) {
    children.push(createParagraph({
      text: paper.description,
      spacing: { after: 180 },
    }));
  }

  children.push(new Paragraph({
    spacing: { after: 220 },
    children: [
      new TextRun({ text: `${paper.questions.length} ${labels.questionsUnit}` }),
      new TextRun({ text: '    ' }),
      new TextRun({ text: `${labels.totalScore}: ${paper.total_score}` }),
    ],
  }));

  (paper.questions as PaperQuestion[]).forEach((paperQuestion, index) => {
    children.push(createParagraph({
      text: `${index + 1}. (${paperQuestion.score}${labels.points}) ${paperQuestion.question.content}`,
      spacing: { before: 180, after: 120 },
    }));

    paperQuestion.question.options.forEach((optionText, optionIndex) => {
      children.push(createParagraph({
        text: `${String.fromCharCode(65 + optionIndex)}. ${normalizeQuizOptionText(optionText, optionIndex)}`,
        spacing: { after: 80 },
        indent: { left: 360 },
      }));
    });

    if (includeAnswers) {
      children.push(createParagraph({
        prefix: `${labels.answer}：`,
        boldPrefix: true,
        text: formatQuizPaperAnswer(paperQuestion.question) || '—',
        spacing: { before: 80, after: 60 },
      }));

      const explanation = ((paperQuestion.question as any).explanation as string | undefined)?.trim();
      if (explanation) {
        children.push(createParagraph({
          prefix: `${labels.explanation}：`,
          boldPrefix: true,
          text: explanation,
          spacing: { after: 120 },
        }));
      }
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_FONT,
            size: 24,
          },
          paragraph: {
            spacing: {
              line: 360,
            },
          },
        },
      },
    },
  });

  return Packer.toArrayBuffer(doc);
}

export async function createQuizPaperDocxBlob(paper: QuizPaper, includeAnswers: boolean, labels: QuizPaperExportLabels) {
  const buffer = await createQuizPaperDocxBuffer(paper, includeAnswers, labels);
  return new Blob([buffer], { type: DOCX_MIME });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function exportQuizPaperExcel(paper: QuizPaper, includeAnswers: boolean, labels: QuizPaperExportLabels) {
  const rows = getQuizPaperExportRows(paper, includeAnswers, labels);
  const headers = includeAnswers
    ? ['序号', '题型', '题目', '选项A', '选项B', '选项C', '选项D', '分值', '答案', '解析']
    : ['序号', '题型', '题目', '选项A', '选项B', '选项C', '选项D', '分值'];

  await writeExcelFile(
    [headers, ...rows],
    paper.title.slice(0, 30),
    `${paper.title}.xlsx`,
    includeAnswers ? [5, 8, 40, 15, 15, 15, 15, 8, 10, 28] : [5, 8, 40, 15, 15, 15, 15, 8],
  );
}

async function exportQuizPaperPdf(paper: QuizPaper, includeAnswers: boolean, labels: QuizPaperExportLabels) {
  const { host, container } = createQuizPaperExportContainer(paper, includeAnswers, labels, { includeTitle: false });
  document.body.appendChild(host);

  try {
    await exportToPDF(container, paper.title, paper.title);
  } finally {
    document.body.removeChild(host);
  }
}

async function exportQuizPaperDocx(paper: QuizPaper, includeAnswers: boolean, labels: QuizPaperExportLabels) {
  const blob = await createQuizPaperDocxBlob(paper, includeAnswers, labels);
  downloadBlob(blob, `${paper.title}.docx`);
}

export async function exportQuizPaper(paper: QuizPaper, options: ExportQuizPaperOptions) {
  if (options.format === 'xlsx') {
    await exportQuizPaperExcel(paper, options.includeAnswers, options.labels);
    return;
  }

  if (options.format === 'pdf') {
    await exportQuizPaperPdf(paper, options.includeAnswers, options.labels);
    return;
  }

  await exportQuizPaperDocx(paper, options.includeAnswers, options.labels);
}