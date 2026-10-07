import { fireEvent, render, screen } from '@testing-library/react';
import FormulaEditor from './FormulaEditor';

describe('Formula puzzle editor', () => {
  it('assembles, edits, reorders and inserts math blocks', () => {
    const insert = vi.fn();
    render(<FormulaEditor onInsert={insert} />);
    fireEvent.click(screen.getByLabelText('添加分式公式块'));
    fireEvent.change(screen.getByLabelText('分子'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('分母'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('添加加号公式块'));
    fireEvent.click(screen.getByLabelText('添加幂公式块'));
    fireEvent.change(screen.getByLabelText('指数'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('前移公式块'));
    fireEvent.click(screen.getByText('插入', { selector: 'button' }));
    expect(insert).toHaveBeenCalledWith('$\\frac{1}{2} {x}^{3} +$');
    expect(screen.getByLabelText('公式拼图区').querySelectorAll('[data-formula-block]')).toHaveLength(0);
  });
  it('assembles chemistry with editable coefficients and conditions', () => {
    const insert = vi.fn();
    const { container } = render(<FormulaEditor defaultSubject="chem" onInsert={insert} />);
    for (const name of ['氢气', '加号', '氧气', '反应箭头']) fireEvent.click(screen.getByLabelText(`添加${name}公式块`));
    fireEvent.change(screen.getByLabelText('箭头上方条件'), { target: { value: '加热' } });
    fireEvent.click(screen.getByLabelText('添加水公式块'));
    fireEvent.click(screen.getByLabelText('添加气体公式块'));
    expect(container.querySelector('.katex-error')).toBeNull();
    fireEvent.click(screen.getByText('插入', { selector: 'button' }));
    expect(insert).toHaveBeenCalledWith('$\\ce{2H2} + \\ce{O2} \\ce{->[加热][]} \\ce{2H2O} \\uparrow$');
  });
  it('preserves direct LaTeX when switching back to puzzle and deletes blocks', () => {
    render(<FormulaEditor onInsert={vi.fn()} />);
    fireEvent.click(screen.getByText('LaTeX', { selector: 'button' }));
    fireEvent.change(screen.getByLabelText('公式 LaTeX'), { target: { value: 'a+b' } });
    fireEvent.click(screen.getByText('公式拼图', { selector: 'button' }));
    fireEvent.click(screen.getByLabelText('编辑自定义公式块'));
    expect(screen.getByLabelText('LaTeX')).toHaveValue('a+b');
    fireEvent.click(screen.getByLabelText('删除公式块'));
    expect(screen.getByText('插入', { selector: 'button' })).toBeDisabled();
  });
});