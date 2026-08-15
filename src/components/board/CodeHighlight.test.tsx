import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CodeHighlight from './CodeHighlight';

const CODE = `function greet(name) {\n    const msg = "hi " + name;\n\treturn msg;\n}`;

describe('CodeHighlight', () => {
  it('renders one row per line with line numbers', async () => {
    const { container } = render(<CodeHighlight code={CODE} ext="js" />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
    expect(rows[0].textContent).toContain('1');
    expect(rows[3].textContent).toContain('4');
  });

  it('applies prism syntax highlighting tokens', async () => {
    const { container } = render(<CodeHighlight code={CODE} ext="js" />);
    await waitFor(() => {
      expect(container.querySelectorAll('.token').length).toBeGreaterThan(0);
    });
    expect(container.querySelector('.language-javascript')).toBeTruthy();
  });

  it('preserves original indentation and whitespace', async () => {
    const { container } = render(<CodeHighlight code={CODE} ext="js" />);
    await waitFor(() => {
      expect(container.querySelectorAll('.token').length).toBeGreaterThan(0);
    });
    const cells = container.querySelectorAll('tbody tr td:nth-child(2)');
    expect(cells[1].className).toContain('whitespace-pre');
    expect(cells[1].textContent).toBe('    const msg = "hi " + name;');
    expect(cells[2].textContent).toBe('\treturn msg;');
  });

  it('falls back to plain text for unknown languages', async () => {
    const { container } = render(<CodeHighlight code={'hello world'} ext="unknownext" />);
    await waitFor(() => {
      expect(container.querySelector('tbody tr')?.textContent).toContain('hello world');
    });
  });

  it('renders a resize handle for height adjustment', () => {
    render(<CodeHighlight code={CODE} ext="js" />);
    expect(screen.getByTitle('拖拽调整高度')).toBeInTheDocument();
  });
});
