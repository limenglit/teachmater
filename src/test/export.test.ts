import { describe, it, expect, vi, beforeEach } from 'vitest';
import html2canvas from 'html2canvas';
import { exportToPrint, elementToDataURL } from '@/lib/export';

// html2canvas is used to generate a canvas object; we mock it to control outputs
vi.mock('html2canvas');

describe('export utilities', () => {
  beforeEach(() => {
    // mock window.open to return a simple object with print/close methods
    vi.spyOn(window, 'open').mockImplementation(() => {
      return {
        document: document.implementation.createHTMLDocument(''),
        close: () => {},
        focus: () => {},
        print: () => {},
      } as any;
    });

    // mock canvas returned by html2canvas
    ((html2canvas as unknown) as vi.Mock).mockResolvedValue({
      width: 100,
      height: 100,
      toDataURL: () => 'data:image/png;base64,mock',
    } as any);
  });

  it('exportToPrint should not throw and should call window.open', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>test</p>';
    expect(() => exportToPrint(div)).not.toThrow();
    expect(window.open).toHaveBeenCalled();
  });

  it('elementToDataURL returns a data URL string', async () => {
    const div = document.createElement('div');
    const url = await elementToDataURL(div);
    expect(url).toBe('data:image/png;base64,mock');
  });
});
