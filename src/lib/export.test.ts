import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the wrapper that html2canvas receives so we can assert on the
// neutralized DOM used for PNG/SVG/PDF exports.
const html2canvasCalls: HTMLElement[] = [];
const baselineFixDuringCapture: boolean[] = [];

vi.mock('html2canvas', () => ({
  default: vi.fn(async (el: HTMLElement) => {
    // Clone at call time — export code removes the wrapper right after.
    html2canvasCalls.push(el.cloneNode(true) as HTMLElement);
    baselineFixDuringCapture.push(!!document.head.querySelector('style[data-export-baseline-fix]'));
    return {
      width: 100,
      height: 100,
      toDataURL: () => 'data:image/png;base64,AAAA',
    } as unknown as HTMLCanvasElement;
  }),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: () => {}, unmount: () => {} }),
}));

vi.mock('qrcode.react', () => ({ QRCodeSVG: () => null }));

import { exportToPNG, exportToPDF, exportToSVG, BASELINE_FIX_ATTR } from './export';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

function buildSeatGrid(): HTMLElement {
  const root = document.createElement('div');
  root.style.width = '600px';
  root.className = 'seat-grid';

  // Simulate a 1x3 row where the middle seat is disabled.
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';

  const makeSeat = (name: string, disabled: boolean) => {
    const cell = document.createElement('div');
    cell.textContent = name;
    cell.style.width = '80px';
    cell.style.height = '40px';
    cell.style.border = '1px solid #333';
    cell.style.background = '#eef';
    cell.className = 'seat-cell';
    if (disabled) cell.setAttribute('data-disabled-seat', 'true');
    return cell;
  };

  row.appendChild(makeSeat('A1', false));
  row.appendChild(makeSeat('A2', true));
  row.appendChild(makeSeat('A3', false));
  root.appendChild(row);

  document.body.appendChild(root);
  return root;
}

const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  html2canvasCalls.length = 0;
  // jsdom stubs — anchor click should be a noop
  const anchorClick = vi.fn();
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') (el as HTMLAnchorElement).click = anchorClick;
    return el;
  });
  // URL.createObjectURL used by SVG export
  // @ts-ignore
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  // @ts-ignore
  URL.revokeObjectURL = vi.fn();
});

describe('export – disabled seats', () => {
  it('hides disabled seats but preserves the grid slot in PNG export', async () => {
    const grid = buildSeatGrid();
    await exportToPNG(grid, 'seatmap', '座位图');

    expect(html2canvasCalls).toHaveLength(1);
    const captured = html2canvasCalls[0];
    const disabledSeats = captured.querySelectorAll<HTMLElement>('[data-disabled-seat="true"]');
    expect(disabledSeats.length).toBe(1);

    for (const el of Array.from(disabledSeats)) {
      expect(el.style.visibility).toBe('hidden');
      expect(el.style.background).toBe('transparent');
      // jsdom's shorthand parser drops `border: none`, but the individual
      // longhand values reflect the removed border.
      expect(el.style.borderStyle || 'none').toBe('none');
      expect(el.textContent).toBe('');
    }

    // Sibling active seats must remain visible so the grid alignment holds.
    const visibleSeats = Array.from(
      captured.querySelectorAll<HTMLElement>('.seat-cell'),
    ).filter(el => el.getAttribute('data-disabled-seat') !== 'true');
    expect(visibleSeats).toHaveLength(2);
    for (const el of visibleSeats) {
      expect(el.style.visibility).not.toBe('hidden');
      expect(el.textContent).not.toBe('');
    }

    // The disabled seat still occupies a slot in its parent row (grid slot kept).
    const row = captured.querySelector<HTMLElement>('.seat-grid > div');
    expect(row?.children.length).toBe(3);
  });

  it('applies the same disabled-seat hiding in PDF export', async () => {
    const grid = buildSeatGrid();
    await exportToPDF(grid, 'seatmap', '座位图');
    expect(html2canvasCalls).toHaveLength(1);
    const disabled = html2canvasCalls[0].querySelector<HTMLElement>('[data-disabled-seat="true"]');
    expect(disabled?.style.visibility).toBe('hidden');
    expect(disabled?.textContent).toBe('');
  });

  it('applies the same disabled-seat hiding in SVG export', async () => {
    const grid = buildSeatGrid();
    await exportToSVG(grid, 'seatmap', '座位图');
    // SVG export routes through captureWithHeaderFooter, so html2canvas is invoked.
    expect(html2canvasCalls.length).toBeGreaterThanOrEqual(1);
    const disabled = html2canvasCalls[0].querySelector<HTMLElement>('[data-disabled-seat="true"]');
    expect(disabled?.style.visibility).toBe('hidden');
  });
});

describe('export – seating layout', () => {
  it.each(['png', 'pdf'] as const)('restores room dimensions but preserves positioned labels in %s', async kind => {
    const root = document.createElement('div');
    const scroll = document.createElement('div');
    scroll.className = 'overflow-auto max-h-[80vh]';
    const frame = document.createElement('div');
    frame.className = 'mx-auto';
    frame.style.width = '360px';
    frame.style.height = '180px';
    const room = document.createElement('div');
    room.style.width = '900px';
    room.style.height = '450px';
    room.style.transform = 'scale(0.4)';
    const label = document.createElement('span');
    label.textContent = '张三';
    label.style.transform = 'translate(120px, 40px) rotate(15deg)';
    room.appendChild(label);
    frame.appendChild(room);
    scroll.appendChild(frame);
    root.appendChild(scroll);
    document.body.appendChild(root);

    if (kind === 'png') await exportToPNG(root, 'seatmap');
    else await exportToPDF(root, 'seatmap');

    const captured = html2canvasCalls[0];
    const exportedFrame = captured.querySelector<HTMLElement>('.mx-auto');
    expect(exportedFrame?.style.width).toBe('900px');
    expect(exportedFrame?.style.height).toBe('450px');
    expect(exportedFrame?.firstElementChild?.getAttribute('style')).toContain('transform: none');
    expect(captured.querySelector('span')?.style.transform).toBe('translate(120px, 40px) rotate(15deg)');
    expect(captured.querySelector('.overflow-auto')?.getAttribute('style')).toContain('overflow: visible');
    expect(root.querySelector('.mx-auto')?.getAttribute('style')).toContain('width: 360px');
  });

  it('fits a tall chart onto one PDF page without cutting through names', async () => {
    const root = buildSeatGrid();
    await exportToPDF(root, 'seatmap');
    const pdf = vi.mocked(jsPDF).mock.results.at(-1)?.value;
    expect(pdf.addImage).toHaveBeenCalledTimes(1);
    expect(pdf.addPage).not.toHaveBeenCalled();
    const [, , x, y, width, height] = pdf.addImage.mock.calls[0];
    expect(x).toBeGreaterThanOrEqual(6);
    expect(y).toBeGreaterThanOrEqual(6);
    expect(width).toBeLessThanOrEqual(829);
    expect(height).toBeLessThanOrEqual(829);
  });

  it('places every seat index page on a full A4 sheet at the same scale', async () => {
    const root = buildSeatGrid();
    const index = Array.from({ length: 130 }, (_, i) => ({ name: `学生${i}`, studentNumber: `2023010401${String(i).padStart(2, '0')}`, row: 1 + (i % 10), col: 1 + Math.floor(i / 10) }));
    await exportToPDF(root, 'seatmap', '座位图', index);
    const pdf = vi.mocked(jsPDF).mock.results.at(-1)?.value;
    // 130 long-number students → 2 columns × 32 rows → 3 index pages
    expect(pdf.addPage).toHaveBeenCalledTimes(3);
    const indexCalls = pdf.addImage.mock.calls.slice(1);
    expect(indexCalls).toHaveLength(3);
    for (const call of indexCalls) expect(call.slice(2, 6)).toEqual([0, 0, 210, 297]);
  });

  it('restores a zoomed classroom grid and removes its zoom toolbar without touching seat transforms', async () => {
    const root = document.createElement('div');
    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-export-exclude', '');
    toolbar.textContent = 'zoom controls';
    const grid = document.createElement('div');
    grid.setAttribute('data-export-unscale', '');
    grid.style.transform = 'scale(0.35)';
    const seat = document.createElement('span');
    seat.style.transform = 'translate(80px, 20px)';
    seat.textContent = '王小明';
    grid.appendChild(seat);
    root.append(toolbar, grid);
    document.body.appendChild(root);

    await exportToPNG(root, 'large-class');
    const captured = html2canvasCalls[0];
    expect(captured.querySelector('[data-export-exclude]')).toBeNull();
    expect(captured.querySelector<HTMLElement>('[data-export-unscale]')?.style.transform).toBe('none');
    expect(captured.querySelector('span')?.style.transform).toBe('translate(80px, 20px)');
    expect(grid.style.transform).toBe('scale(0.35)');
  });

  it('expands scroll-limited classrooms for capture and uses higher resolution', async () => {
    const root = document.createElement('div');
    const scroller = document.createElement('div');
    scroller.className = 'overflow-auto max-h-[75vh]';
    scroller.style.height = '400px';
    scroller.style.width = '480px';
    const grid = document.createElement('div');
    grid.style.width = '1500px';
    grid.style.height = '900px';
    const seat = document.createElement('div');
    seat.className = 'overflow-hidden';
    seat.style.width = '80px';
    seat.style.height = '44px';
    seat.textContent = '最后一排 张同学';
    grid.appendChild(seat);
    scroller.appendChild(grid);
    root.appendChild(scroller);
    document.body.appendChild(root);

    await exportToPNG(root, 'large-class');
    const captured = html2canvasCalls[0].querySelector<HTMLElement>('.overflow-auto');
    expect(captured?.style.height).toBe('auto');
    expect(captured?.style.width).toBe('auto');
    expect(captured?.style.overflow).toBe('visible');
    const capturedSeat = html2canvasCalls[0].querySelector<HTMLElement>('.overflow-hidden');
    expect(capturedSeat?.style.width).toBe('80px');
    expect(capturedSeat?.style.height).toBe('44px');
    expect(html2canvasCalls[0].textContent).toContain('最后一排 张同学');
    expect(vi.mocked(html2canvas).mock.lastCall?.[1]?.scale).toBe(3);
  });
});

describe('export – text placement and legend', () => {
  it('keeps html2canvas baseline probe inline only while capturing', async () => {
    baselineFixDuringCapture.length = 0;
    await exportToPDF(buildSeatGrid(), 'seatmap', '座位图', [{ name: '张伟', row: 1, col: 1 }]);
    expect(baselineFixDuringCapture).toEqual([true, true]);
    expect(document.head.querySelector(`style[${BASELINE_FIX_ATTR}]`)).toBeNull();
  });

  it('prints the unit color legend that is hidden on screen', async () => {
    const root = buildSeatGrid();
    const legend = document.createElement('div');
    legend.setAttribute('data-export-only', '');
    legend.className = 'hidden flex-wrap';
    legend.textContent = '护理学院';
    root.appendChild(legend);
    await exportToPNG(root, 'seatmap');
    const printed = html2canvasCalls[0].querySelector<HTMLElement>('[data-export-only]');
    expect(printed?.classList.contains('hidden')).toBe(false);
    expect(printed?.style.display).toBe('flex');
    expect(printed?.style.minWidth).toBe('100%');
    expect(legend.classList.contains('hidden')).toBe(true);
  });
});
