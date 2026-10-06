// Formula templates grouped by subject → category. `latex` is inserted wrapped in $...$.
export interface FormulaItem { label: string; latex: string }
export interface FormulaCategory { id: string; name: string; items: FormulaItem[] }
export interface FormulaSubject { id: string; name: string; categories: FormulaCategory[] }

const f = (latex: string, label = latex): FormulaItem => ({ latex, label });

export const FORMULA_LIBRARY: FormulaSubject[] = [
  {
    id: 'math', name: '数学', categories: [
      { id: 'basic', name: '基础运算', items: [f('a+b'), f('a-b'), f('a\\times b'), f('a\\div b'), f('a\\cdot b'), f('\\pm'), f('\\mp'), f('='), f('\\neq'), f('\\approx'), f('<'), f('>'), f('\\leq'), f('\\geq'), f('\\equiv'), f('|x|'), f('\\%')] },
      { id: 'frac', name: '分式根式', items: [f('\\frac{a}{b}'), f('\\dfrac{a}{b}'), f('\\sqrt{x}'), f('\\sqrt[n]{x}'), f('x^{2}'), f('x^{n}'), f('x_{1}'), f('x_{n}^{2}'), f('a^{-1}'), f('a^{\\frac{m}{n}}')] },
      { id: 'func', name: '函数', items: [f('f(x)'), f('f^{-1}(x)'), f('y=kx+b'), f('y=ax^{2}+bx+c'), f('x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}'), f('\\log_{a}x'), f('\\lg x'), f('\\ln x'), f('e^{x}'), f('a^{x}'), f('\\max\\{a,b\\}'), f('\\min\\{a,b\\}')] },
      { id: 'trig', name: '三角函数', items: [f('\\sin\\alpha'), f('\\cos\\alpha'), f('\\tan\\alpha'), f('\\sin^{2}\\alpha+\\cos^{2}\\alpha=1'), f('\\sin(\\alpha\\pm\\beta)'), f('\\arcsin x'), f('\\arccos x'), f('\\arctan x'), f('30^{\\circ}'), f('\\frac{\\pi}{6}'), f('\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=2R'), f('c^{2}=a^{2}+b^{2}-2ab\\cos C')] },
      { id: 'geo', name: '几何向量', items: [f('\\angle ABC'), f('\\triangle ABC'), f('\\parallel'), f('\\perp'), f('\\cong'), f('\\sim'), f('\\overline{AB}'), f('\\overrightarrow{AB}'), f('\\vec{a}'), f('|\\vec{a}|'), f('\\vec{a}\\cdot\\vec{b}'), f('\\odot O'), f('\\stackrel{\\frown}{AB}', '弧AB')] },
      { id: 'set', name: '集合逻辑', items: [f('\\in'), f('\\notin'), f('\\subseteq'), f('\\subsetneqq'), f('\\cup'), f('\\cap'), f('\\varnothing'), f('\\complement_{U}A'), f('\\mathbb{N}'), f('\\mathbb{Z}'), f('\\mathbb{Q}'), f('\\mathbb{R}'), f('\\mathbb{C}'), f('\\{x\\mid x>0\\}'), f('\\forall'), f('\\exists'), f('\\neg p'), f('\\land'), f('\\lor'), f('\\Rightarrow'), f('\\Leftrightarrow')] },
      { id: 'seq', name: '数列不等式', items: [f('a_{n}'), f('S_{n}'), f('a_{n}=a_{1}+(n-1)d'), f('a_{n}=a_{1}q^{n-1}'), f('\\sum_{i=1}^{n}a_{i}'), f('\\prod_{i=1}^{n}a_{i}'), f('\\frac{a+b}{2}\\geq\\sqrt{ab}'), f('(a,b)'), f('[a,b]'), f('(-\\infty,+\\infty)')] },
      { id: 'calc', name: '微积分', items: [f('\\lim_{x\\to 0}'), f('\\lim_{n\\to\\infty}'), f("f'(x)"), f("f''(x)"), f('\\frac{dy}{dx}'), f('\\frac{\\partial f}{\\partial x}'), f('\\int f(x)\\,dx'), f('\\int_{a}^{b}f(x)\\,dx'), f('\\iint_{D}'), f('\\oint'), f('\\infty'), f('\\Delta x')] },
      { id: 'prob', name: '概率统计', items: [f('P(A)'), f('P(A|B)'), f('C_{n}^{k}'), f('A_{n}^{k}'), f('\\binom{n}{k}'), f('n!'), f('\\bar{x}'), f('s^{2}'), f('E(X)'), f('D(X)'), f('X\\sim B(n,p)'), f('X\\sim N(\\mu,\\sigma^{2})')] },
      { id: 'matrix', name: '矩阵复数', items: [f('\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', '矩阵'), f('\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}', '行列式'), f('\\begin{cases}x+y=1\\\\x-y=0\\end{cases}', '方程组'), f('A^{T}'), f('A^{-1}'), f('z=a+bi'), f('\\bar{z}'), f('|z|'), f('i^{2}=-1')] },
      { id: 'greek', name: '希腊字母', items: ['\\alpha','\\beta','\\gamma','\\delta','\\epsilon','\\theta','\\lambda','\\mu','\\pi','\\rho','\\sigma','\\tau','\\varphi','\\omega','\\Delta','\\Sigma','\\Omega'].map((x) => f(x)) },
    ],
  },
  {
    id: 'physics', name: '物理', categories: [
      { id: 'mech', name: '力学', items: [f('F=ma'), f('v=v_{0}+at'), f('x=v_{0}t+\\frac{1}{2}at^{2}'), f('v^{2}-v_{0}^{2}=2ax'), f('G=mg'), f('f=\\mu F_{N}'), f('F=kx'), f('W=Fs\\cos\\theta'), f('P=\\frac{W}{t}'), f('E_{k}=\\frac{1}{2}mv^{2}'), f('E_{p}=mgh'), f('p=mv'), f('F\\Delta t=\\Delta p')] },
      { id: 'circ', name: '圆周与引力', items: [f('\\omega=\\frac{2\\pi}{T}'), f('v=\\omega r'), f('a=\\frac{v^{2}}{r}'), f('F=m\\omega^{2}r'), f('F=G\\frac{Mm}{r^{2}}'), f('g=\\frac{GM}{R^{2}}')] },
      { id: 'em', name: '电磁学', items: [f('I=\\frac{U}{R}'), f('R=\\rho\\frac{L}{S}'), f('P=UI'), f('Q=I^{2}Rt'), f('F=k\\frac{q_{1}q_{2}}{r^{2}}'), f('E=\\frac{F}{q}'), f('C=\\frac{Q}{U}'), f('F=BIL'), f('F=qvB'), f('E=BLv'), f('E=n\\frac{\\Delta\\Phi}{\\Delta t}'), f('\\frac{U_{1}}{U_{2}}=\\frac{n_{1}}{n_{2}}')] },
      { id: 'heat', name: '热学光学', items: [f('Q=cm\\Delta t'), f('pV=nRT'), f('\\frac{p_{1}V_{1}}{T_{1}}=\\frac{p_{2}V_{2}}{T_{2}}'), f('\\Delta U=W+Q'), f('n=\\frac{\\sin i}{\\sin r}'), f('n=\\frac{c}{v}'), f('\\frac{1}{u}+\\frac{1}{v}=\\frac{1}{f}'), f('c=\\lambda f')] },
      { id: 'modern', name: '近代物理', items: [f('E=h\\nu'), f('E_{k}=h\\nu-W_{0}'), f('E=mc^{2}'), f('\\lambda=\\frac{h}{p}'), f('{}_{92}^{235}\\mathrm{U}'), f('{}_{2}^{4}\\mathrm{He}'), f('{}_{0}^{1}\\mathrm{n}')] },
      { id: 'vec', name: '矢量符号', items: [f('\\vec{F}'), f('\\vec{v}'), f('\\vec{a}'), f('\\vec{E}'), f('\\vec{B}'), f('\\boldsymbol{F}'), f('F_{合}'), f('\\Delta v'), f('\\propto')] },
      { id: 'unit', name: '单位', items: [f('\\mathrm{m/s}'), f('\\mathrm{m/s^{2}}'), f('\\mathrm{N}'), f('\\mathrm{J}'), f('\\mathrm{W}'), f('\\mathrm{Pa}'), f('\\mathrm{kg/m^{3}}'), f('\\mathrm{V}'), f('\\mathrm{A}'), f('\\Omega'), f('\\mathrm{T}'), f('\\mathrm{Hz}'), f('^{\\circ}\\mathrm{C}'), f('\\mathrm{eV}'), f('3.0\\times10^{8}\\,\\mathrm{m/s}')] },
    ],
  },
  {
    id: 'chem', name: '化学', categories: [
      { id: 'formula', name: '化学式', items: [f('\\ce{H2O}'), f('\\ce{CO2}'), f('\\ce{O2}'), f('\\ce{NaCl}'), f('\\ce{H2SO4}'), f('\\ce{HNO3}'), f('\\ce{NaOH}'), f('\\ce{CaCO3}'), f('\\ce{Fe2O3}'), f('\\ce{CuSO4*5H2O}'), f('\\ce{NH3}'), f('\\ce{KMnO4}')] },
      { id: 'ion', name: '离子', items: [f('\\ce{H+}'), f('\\ce{OH-}'), f('\\ce{Na+}'), f('\\ce{Cl-}'), f('\\ce{SO4^2-}'), f('\\ce{CO3^2-}'), f('\\ce{NH4+}'), f('\\ce{Fe^3+}'), f('\\ce{Cu^2+}'), f('\\ce{NO3-}')] },
      { id: 'react', name: '反应方程', items: [f('\\ce{A + B -> C}'), f('\\ce{2H2 + O2 ->[点燃] 2H2O}'), f('\\ce{CaCO3 ->[高温] CaO + CO2 ^}'), f('\\ce{N2 + 3H2 <=>[催化剂][高温高压] 2NH3}'), f('\\ce{AgNO3 + NaCl = AgCl v + NaNO3}'), f('\\ce{->}'), f('\\ce{<=>}'), f('\\ce{^}', '↑气体'), f('\\ce{v}', '↓沉淀'), f('\\ce{->[\\Delta]}', '加热')] },
      { id: 'valence', name: '化合价电子', items: [f('\\overset{+1}{\\mathrm{Na}}'), f('\\overset{-2}{\\mathrm{O}}'), f('\\ce{Fe - 2e- -> Fe^2+}'), f('\\ce{e-}'), f('{}_{6}^{12}\\mathrm{C}'), f('{}_{17}^{35}\\mathrm{Cl}')] },
      { id: 'organic', name: '有机', items: [f('\\ce{CH4}'), f('\\ce{C2H4}'), f('\\ce{C2H5OH}'), f('\\ce{CH3COOH}'), f('\\ce{C6H6}'), f('\\ce{CH3COOC2H5}'), f('\\ce{C6H12O6}'), f('\\ce{-OH}'), f('\\ce{-COOH}'), f('\\ce{CH2=CH2}'), f('\\ce{HC#CH}')] },
      { id: 'quant', name: '定量计算', items: [f('n=\\frac{m}{M}'), f('n=\\frac{V}{V_{m}}'), f('c=\\frac{n}{V}'), f('N_{A}'), f('\\mathrm{mol/L}'), f('\\mathrm{g/mol}'), f('\\mathrm{pH}=-\\lg c(\\ce{H+})'), f('K=\\frac{c^{c}(C)}{c^{a}(A)c^{b}(B)}'), f('\\omega=\\frac{m_{质}}{m_{液}}\\times100\\%'), f('\\Delta H<0')] },
    ],
  },
];

export const MATH_SUBJECT_PATTERN = /数学|代数|几何|函数|微积分|概率|统计|物理|力学|电学|电磁|光学|热学|化学|有机|无机|math|algebra|geometry|calculus|physics|chemistry/i;
