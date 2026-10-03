import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the wrapper that html2canvas receives so we can assert on the
// neutralized DOM used for PNG/SVG/PDF exports.
const html2canvasCalls: HTMLElement[] = [];

vi.mock('html2canvas', () => ({
  default: vi.fn(async (el: HTMLElement) => {
    // Clone at call time — export code removes the wrapper right after.
    html2canvasCalls.push(el.cloneNode(true) as HTMLElement);
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

import { exportToPNG, exportToPDF, exportToSVG } from './export';
import { jsPDF } from 'jspdf';

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
});
