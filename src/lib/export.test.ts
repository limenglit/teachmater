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
      expect(el.style.border).toBe('none');
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
