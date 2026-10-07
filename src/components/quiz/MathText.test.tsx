import { render, screen } from '@testing-library/react';
import MathText from './MathText';
import { FORMULA_LIBRARY } from '@/lib/formula-library';

describe('MathText subject rendering', () => {
  it.each([
    ['math', '$x_{1}^{2}+\\frac{1}{\\sqrt{x}}$'],
    ['physics', '\\(E_{k}=\\frac{1}{2}mv^{2}\\)'],
    ['chemistry', '\\[\\ce{N2 + 3H2 <=>[催化剂][高温高压] 2NH3}\\]'],
    ['ions', '$\\ce{SO4^2- + Ba^2+ -> BaSO4 v}$'],
  ])('renders %s as accessible notation', (_subject, text) => {
    const { container } = render(<MathText text={text} />);
    expect(screen.getByRole('math')).toBeInTheDocument();
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.querySelector('.katex-mathml math')).not.toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
  });

  it('renders every subject template without errors', () => {
    const formulas = FORMULA_LIBRARY.flatMap(s => s.categories.flatMap(c => c.items));
    const { container } = render(<MathText text={formulas.map(f => `$${f.latex}$`).join('\n')} />);
    expect(container.querySelectorAll('.math-formula')).toHaveLength(formulas.length);
    expect(container.querySelector('.katex-error')).toBeNull();
  });

  it('separates display formulas and preserves surrounding plain text safely', () => {
    const { container } = render(<MathText text={'题干\n$$\\frac{a}{b}$$\n<script>alert(1)</script>'} />);
    expect(container.querySelector('.math-formula-display')).not.toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('题干\n');
  });
});