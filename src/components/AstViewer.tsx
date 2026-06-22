import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as acorn from 'acorn';
import { 
  Code, 
  GitMerge, 
  Search, 
  Layers, 
  Activity, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle, 
  CheckCircle, 
  FileCode, 
  Maximize2, 
  Minimize2, 
  Flame, 
  Compass, 
  Sparkles,
  Info,
  Sliders,
  Filter,
  Check,
  RotateCcw
} from 'lucide-react';

// --- Types ---
interface ASTNode {
  type: string;
  start: number;
  end: number;
  [key: string]: any;
}

interface ASTStats {
  codeBytes: number;
  lineCount: number;
  totalNodes: number;
  maxDepth: number;
  nodeTypesCount: Record<string, number>;
  categoryCount: {
    declarations: number;
    expressions: number;
    statements: number;
    literals: number;
    identifiers: number;
    others: number;
  };
}

// Preset Code Templates
const CODE_PRESETS = [
  {
    id: 'simple-assign',
    title: 'Variable Assignment',
    description: 'Basic variable binding with expression literals',
    code: `// Define wallet credentials
const systemName = "WalletPro Cloud";
const depositFeeRate = 0.015;
let isActive = true;`
  },
  {
    id: 'conditional',
    title: 'Conditional Branching',
    description: 'If-else statements checking authorization and rules',
    code: `if (user.role === 'ADMIN') {
  approveRequest(tx.id);
  logSystemAction("Transaction Approved");
} else {
  alert("Authorization Denied! Only administrators can override fees.");
}`
  },
  {
    id: 'fibonacci',
    title: 'Recursive Fibonacci',
    description: 'Function declarations, conditional base cases, and operations',
    code: `function fibonacci(n) {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}`
  },
  {
    id: 'array-map',
    title: 'Array Transformations',
    description: 'Working with array objects and arrow functions',
    code: `const transactionAmounts = [120, 450, 980, 50, 1500];
const commissions = transactionAmounts.map(amount => {
  const tax = amount * 0.05;
  return tax + 1.5;
});`
  },
  {
    id: 'oop',
    title: 'Class Definition & Call',
    description: 'Object-oriented programming constructs',
    code: `class SmartWallet {
  constructor(owner, balance) {
    this.owner = owner;
    this.balance = balance;
  }

  deposit(amount) {
    if (amount > 0) {
      this.balance += amount;
    }
  }
}

const myWallet = new SmartWallet("Fahad", 5000);`
  }
];

export default function AstViewer() {
  const [code, setCode] = useState(CODE_PRESETS[0].code);
  const [parsedAst, setParsedAst] = useState<ASTNode | null>(null);
  const [parseError, setParseError] = useState<{ message: string; line: number; column: number; loc?: number } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState(CODE_PRESETS[0].id);
  
  // Interactive UI states
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [selectedNode, setSelectedNode] = useState<ASTNode | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<string>('');
  const [hoveredNode, setHoveredNode] = useState<ASTNode | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  
  // Editor visual states
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // --- Parse Code in Realtime ---
  useEffect(() => {
    try {
      // Configure acorn options: parse as ES modules or scripts, support modern features
      const ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: false // Keep parse simple and light
      }) as unknown as ASTNode;
      
      setParsedAst(ast);
      setParseError(null);
      
      // Auto expand root children
      const newExpanded = new Set(expandedNodes);
      newExpanded.add('root');
      if (ast && ast.body) {
        ast.body.forEach((_: any, idx: number) => {
          newExpanded.add(`root-body-${idx}`);
        });
      }
      setExpandedNodes(newExpanded);
    } catch (err: any) {
      // Extract line and column from the standard acorn error
      const message = err.message || 'Syntax Error';
      const posMatch = err.message.match(/\((\d+):(\d+)\)/);
      let line = 1;
      let column = 0;
      
      if (posMatch) {
         line = parseInt(posMatch[1], 10);
         column = parseInt(posMatch[2], 10);
      } else if (err.loc) {
         line = err.loc.line;
         column = err.loc.column;
      }
      
      setParseError({
        message: message.replace(/\s*\(\d+:\d+\)\s*$/, ''), // clean error coordinate suffix
        line,
        column,
        loc: err.pos
      });
      // Do not clear the existing AST so user can see what worked before the change
    }
  }, [code]);

  // Handle Preset Switching
  const handlePresetSelect = (presetId: string) => {
    const preset = CODE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setCode(preset.code);
      setSelectedPreset(presetId);
      setSelectedNode(null);
      setSelectedNodePath('');
      setSelectionRange(null);
      setFilterQuery('');
    }
  };

  // --- Compute Tree Stats ---
  const stats = useMemo<ASTStats | null>(() => {
    if (!parsedAst) return null;

    let totalNodes = 0;
    let maxDepth = 0;
    const nodeTypesCount: Record<string, number> = {};
    const categoryCount = {
      declarations: 0,
      expressions: 0,
      statements: 0,
      literals: 0,
      identifiers: 0,
      others: 0
    };

    function traverse(node: any, currentDepth: number) {
      if (!node || typeof node !== 'object') return;
      
      totalNodes++;
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }

      const type = node.type || '';
      if (type) {
        nodeTypesCount[type] = (nodeTypesCount[type] || 0) + 1;
        
        // Categorize
        if (type.endsWith('Declaration') || type.endsWith('Declarator')) {
          categoryCount.declarations++;
        } else if (type.endsWith('Expression') || type === 'SpreadElement') {
          categoryCount.expressions++;
        } else if (type.endsWith('Statement') || type === 'SwitchCase' || type === 'CatchClause') {
          categoryCount.statements++;
        } else if (type === 'Literal') {
          categoryCount.literals++;
        } else if (type === 'Identifier') {
          categoryCount.identifiers++;
        } else {
          categoryCount.others++;
        }
      }

      // Read node children
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const val = node[key];
          if (Array.isArray(val)) {
            val.forEach(child => {
              if (child && typeof child === 'object' && child.type) {
                traverse(child, currentDepth + 1);
              }
            });
          } else if (val && typeof val === 'object' && val.type) {
            traverse(val, currentDepth + 1);
          }
        }
      }
    }

    traverse(parsedAst, 1);

    const lineCount = code.split('\n').length;
    const codeBytes = new TextEncoder().encode(code).length;

    return {
      codeBytes,
      lineCount,
      totalNodes,
      maxDepth,
      nodeTypesCount,
      categoryCount
    };
  }, [parsedAst, code]);

  // Expand / Collapse all
  const handleExpandAll = () => {
    if (!parsedAst) return;
    const newExpanded = new Set<string>();
    
    function collectKeys(node: any, path: string) {
      if (!node || typeof node !== 'object') return;
      newExpanded.add(path);
      
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const val = node[key];
          if (Array.isArray(val)) {
            val.forEach((child, index) => {
              if (child && typeof child === 'object' && child.type) {
                collectKeys(child, `${path}-${key}-${index}`);
              }
            });
          } else if (val && typeof val === 'object' && val.type) {
            collectKeys(val, `${path}-${key}`);
          }
        }
      }
    }
    
    collectKeys(parsedAst, 'root');
    setExpandedNodes(newExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set(['root']));
  };

  const toggleExpand = (nodeKey: string) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeKey)) {
      next.delete(nodeKey);
    } else {
      next.add(nodeKey);
    }
    setExpandedNodes(next);
  };

  // Node categorization color guide helper
  const getNodeColorClass = (type: string) => {
    if (type.endsWith('Declaration')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-150 border';
    }
    if (type.endsWith('Statement')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-150 border';
    }
    if (type.endsWith('Expression')) {
      return 'bg-amber-50 text-amber-700 border-amber-150 border';
    }
    if (type === 'Identifier') {
      return 'bg-sky-50 text-sky-700 border-sky-150 border';
    }
    if (type === 'Literal') {
      return 'bg-rose-50 text-rose-700 border-rose-150 border';
    }
    return 'bg-slate-50 text-slate-700 border-slate-150 border';
  };

  // Node Category badge labels
  const getNodeCategory = (type: string) => {
    if (type.endsWith('Declaration')) return 'Declaration';
    if (type.endsWith('Statement')) return 'Statement';
    if (type.endsWith('Expression')) return 'Expression';
    if (type === 'Identifier') return 'Identifier';
    if (type === 'Literal') return 'Literal';
    return 'Other Node';
  };

  // Highlight range in editor
  const highlightCodeRange = (start: number, end: number) => {
    setSelectionRange({ start, end });
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.setSelectionRange(start, end);
    }
  };

  // --- Build Recursive Node Tree Component ---
  const renderTreeNode = (node: any, path: string = 'root', depth: number = 0): React.ReactNode => {
    if (!node || typeof node !== 'object' || !node.type) return null;

    const nodeType = node.type;
    const nodeKey = path;
    const isExpanded = expandedNodes.has(nodeKey);
    
    // Determine children
    const childFields: { key: string; value: any; isArray: boolean }[] = [];
    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        // We only care about objects, nodes or arrays of nodes
        const val = node[key];
        if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object' && val[0].type) {
          childFields.push({ key, value: val, isArray: true });
        } else if (val && typeof val === 'object' && val.type) {
          childFields.push({ key, value: val, isArray: false });
        }
      }
    }

    const hasChildren = childFields.length > 0;
    
    // Quick search hit check
    const query = filterQuery.toLowerCase().trim();
    let isSearchHit = false;
    if (query) {
      isSearchHit = 
        nodeType.toLowerCase().includes(query) ||
        (node.name && String(node.name).toLowerCase().includes(query)) ||
        (node.value !== undefined && String(node.value).toLowerCase().includes(query)) ||
        (node.operator && String(node.operator).toLowerCase().includes(query));
    }

    // Filter by Category
    let categoryMatches = true;
    if (selectedCategoryFilter !== 'ALL') {
      const cat = getNodeCategory(nodeType).toUpperCase();
      categoryMatches = cat === selectedCategoryFilter;
    }

    // Match highlights and selections
    const isSelected = selectedNode?.start === node.start && selectedNode?.end === node.end && selectedNode?.type === node.type;
    const isHovered = hoveredNode?.start === node.start && hoveredNode?.end === node.end && hoveredNode?.type === node.type;

    // Custom short description summary for node visual context
    let briefValue = '';
    if (nodeType === 'Identifier' && node.name) {
      briefValue = `"${node.name}"`;
    } else if (nodeType === 'Literal') {
      briefValue = node.raw || String(node.value);
    } else if (nodeType === 'VariableDeclarator') {
      briefValue = node.id && node.id.name ? `[${node.id.name}]` : '';
    } else if (nodeType === 'BinaryExpression' || nodeType === 'AssignmentExpression') {
      briefValue = `"${node.operator}"`;
    } else if (nodeType === 'MemberExpression') {
      briefValue = node.property && node.property.name ? `.${node.property.name}` : '';
    } else if (nodeType === 'FunctionDeclaration') {
      briefValue = node.id && node.id.name ? `func ${node.id.name}()` : 'anonymous';
    }

    return (
      <div key={nodeKey} className="ml-3 border-l border-slate-100 pl-2 text-left font-sans text-xs">
        {/* Node Label Row */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNode(node);
            setSelectedNodePath(path.replace('root-', '').replaceAll('-body', '').replaceAll('-', ' ➔ '));
            highlightCodeRange(node.start, node.end);
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoveredNode(node);
          }}
          onMouseLeave={() => setHoveredNode(null)}
          className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl cursor-pointer transition-all ${
            isSelected 
              ? 'bg-indigo-600/90 text-white shadow-sm font-semibold' 
              : isHovered 
                ? 'bg-indigo-50 text-indigo-950 scale-[1.01]' 
                : isSearchHit 
                  ? 'bg-amber-100 border border-amber-300'
                  : 'hover:bg-slate-50 text-slate-800'
          } ${!categoryMatches && query === '' ? 'opacity-40' : ''}`}
        >
          {/* Collapse/Expand Toggle */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(nodeKey);
              }}
              className={`p-0.5 rounded hover:bg-slate-200/50 ${isSelected ? 'text-white hover:bg-indigo-800/80' : 'text-slate-400'}`}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-[18px] h-[18px] flex items-center justify-center text-slate-300">•</span>
          )}

          {/* Node Type Tag */}
          <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
            isSelected ? 'bg-indigo-500 text-white font-black' : getNodeColorClass(nodeType)
          }`}>
            {nodeType}
          </span>

          {/* Brief Property Context */}
          {briefValue && (
            <span className={`font-mono font-bold text-[10.5px] px-1 rounded ${
              isSelected ? 'text-indigo-100 bg-indigo-700/60' : 'text-slate-600 bg-slate-100'
            }`}>
              {briefValue}
            </span>
          )}

          {/* Range Code Slice Preview */}
          <span className={`opacity-60 text-[10px] truncate max-w-[200px] font-mono leading-none ${
            isSelected ? 'text-indigo-100' : 'text-slate-400'
          }`}>
            [{node.start}..{node.end}]
          </span>
        </div>

        {/* Child level recurse */}
        {hasChildren && isExpanded && (
          <div className="mt-1 pb-1">
            {childFields.map((field) => {
              if (field.isArray) {
                return (
                  <div key={field.key} className="pl-4 mt-0.5">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest my-0.5 flex items-center gap-1">
                      <GitMerge size={10} className="text-slate-300" />
                      {field.key} <span className="text-[9px] text-slate-300">({field.value.length})</span>
                    </div>
                    {field.value.map((child: any, idx: number) => 
                      renderTreeNode(child, `${nodeKey}-${field.key}-${idx}`, depth + 1)
                    )}
                  </div>
                );
              } else {
                return (
                  <div key={field.key} className="pl-4 mt-0.5 animate-fade-in">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest my-0.5 flex items-center gap-1">
                      <GitMerge size={10} className="text-slate-300" />
                      {field.key}
                    </div>
                    {renderTreeNode(field.value, `${nodeKey}-${field.key}`, depth + 1)}
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    );
  };

  // Helper to extract properties from selected inspection node
  const getSelectedNodeProperties = () => {
    if (!selectedNode) return [];
    
    const ignoredKeys = ['type', 'start', 'end', 'loc'];
    const result: { key: string; value: string; type: string }[] = [];

    for (const key in selectedNode) {
      if (selectedNode.hasOwnProperty(key) && !ignoredKeys.includes(key)) {
        const val = selectedNode[key];
        if (val === null) {
          result.push({ key, value: 'null', type: 'null' });
        } else if (Array.isArray(val)) {
          result.push({ 
            key, 
            value: `Array(${val.length}) [${val.map(v => v?.type || typeof v).join(', ')}]`, 
            type: 'array' 
          });
        } else if (typeof val === 'object' && val.type) {
          result.push({ key, value: `Node { type: "${val.type}" }`, type: 'node' });
        } else if (typeof val === 'object') {
          result.push({ key, value: JSON.stringify(val), type: 'object' });
        } else {
          result.push({ key, value: String(val), type: typeof val });
        }
      }
    }

    return result;
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans border-t border-slate-200">
      {/* Header Panel */}
      <div className="bg-white border-b border-slate-200 py-6 px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-100">
              <GitMerge size={24} className="stroke-[2.5px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">AST Compiler Sandbox</h1>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg border border-indigo-100">Interactive</span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Input modern ES6+ Javascript/TypeScript to dynamically compile its underlying syntax structure into an interactive hierarchical tree.
              </p>
            </div>
          </div>
          
          {/* Preset buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Presets:</span>
            {CODE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetSelect(p.id)}
                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  selectedPreset === p.id 
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-150' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
                title={p.description}
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Core Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Code Input & Syntax Status (lg:span-5) */}
          <div className="lg:col-span-5 space-y-6 flex flex-col">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Source Code Sandbox</h3>
                </div>
                
                {parseError ? (
                  <span className="flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 text-[10.5px] px-2.5 py-1 rounded-xl font-bold animate-pulse">
                    <AlertCircle size={12} />
                    <span>Compile Failure</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10.5px] px-2.5 py-1 rounded-xl font-bold">
                    <CheckCircle size={12} />
                    <span>Ready</span>
                  </span>
                )}
              </div>

              {/* Code TextArea */}
              <div className="relative border border-slate-150 rounded-2xl overflow-hidden focus-within:border-indigo-500 transition-all bg-slate-950 font-mono shadow-inner text-left">
                {/* Visual Line Numbers gutter fake background */}
                <div className="absolute top-0 bottom-0 left-0 w-11 bg-slate-900 border-r border-slate-800/80 pointer-events-none flex flex-col items-center pt-4 text-[11px] text-slate-600 select-none">
                  {code.split('\n').map((_, i) => (
                    <div key={i} className="h-[21px] leading-[21px]">
                      {i + 1}
                    </div>
                  ))}
                </div>

                <textarea
                  ref={editorRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="// Paste or write your Javascript code here..."
                  className="w-full min-h-[350px] pl-14 pr-4 py-4 bg-transparent text-emerald-400 outline-none border-none leading-[21px] text-xs font-mono resize-y caret-white focus:ring-0"
                  spellCheck="false"
                />
              </div>

              {/* Reset/Format operations */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-150">
                <span className="text-[10px] text-slate-400 font-bold tracking-wider font-mono">
                  Characters: {code.length} | Lines: {code.split('\n').length}
                </span>
                
                <button
                  onClick={() => {
                    const original = CODE_PRESETS.find(p => p.id === selectedPreset);
                    if (original) setCode(original.code);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <RotateCcw size={12} />
                  Restore Preset
                </button>
              </div>
            </div>

            {/* Error Notification Block */}
            <AnimatePresence mode="wait">
              {parseError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-rose-50 border border-rose-100 p-5 rounded-3xl shadow-sm text-left font-sans"
                >
                  <div className="flex gap-3">
                    <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg h-fit">
                      <AlertCircle size={16} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Acorn Syntax Parsing Exception</h4>
                      <p className="text-[11.5px] text-rose-800 leading-relaxed font-bold">{parseError.message}</p>
                      
                      <div className="pt-2 text-[10.5px] text-rose-600 font-bold font-mono">
                        Error detected around: <span className="bg-rose-100 px-1 py-0.5 rounded text-rose-700">Line {parseError.line}, Column {parseError.column}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Code Analytics metrics */}
            {stats && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 text-left">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-indigo-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">AST Metrics Summary</h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Nodes</span>
                    <span className="text-lg font-black text-slate-850">{stats.totalNodes}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Max Tree Depth</span>
                    <span className="text-lg font-black text-slate-850">{stats.maxDepth}</span>
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Syntax Categories Distribution</span>
                  <div className="space-y-1.5">
                    {Object.entries({
                      'Declarations': { count: stats.categoryCount.declarations, color: 'bg-emerald-600' },
                      'Expressions': { count: stats.categoryCount.expressions, color: 'bg-amber-500' },
                      'Statements': { count: stats.categoryCount.statements, color: 'bg-indigo-500' },
                      'Identifiers/Names': { count: stats.categoryCount.identifiers, color: 'bg-sky-500' },
                      'Literals/Values': { count: stats.categoryCount.literals, color: 'bg-rose-500' },
                    }).map(([label, info]) => {
                      const percentage = stats.totalNodes > 0 ? (info.count / stats.totalNodes) * 100 : 0;
                      return (
                        <div key={label} className="text-[11px]">
                          <div className="flex justify-between font-semibold text-slate-700">
                            <span>{label}</span>
                            <span>{info.count} ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-0.5">
                            <div className={`${info.color} h-full`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: AST Visual Hierarchical Tree (lg:span-7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <GitMerge size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">AST Node Hierarchies</h3>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleExpandAll}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-slate-150"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={handleCollapseAll}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-slate-150"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Filtering block */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search query input */}
                <div className="md:col-span-7 flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-150 text-slate-700 leading-tight focus-within:border-indigo-400 focus-within:bg-white transition-all">
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter by type, name, or value..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="text-xs bg-transparent outline-none w-full placeholder-slate-400 text-slate-800 focus:ring-0 border-none py-0"
                  />
                  {filterQuery && (
                    <button onClick={() => setFilterQuery('')} className="text-[10px] text-slate-400 hover:text-slate-700 uppercase font-black">Clear</button>
                  )}
                </div>

                {/* Node category select */}
                <div className="md:col-span-5 flex items-center px-3 py-2 bg-slate-50 rounded-2xl border border-slate-150">
                  <Filter size={11} className="text-slate-400 shrink-0 mr-1.5" />
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer w-full focus:ring-0 border-none py-0"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="DECLARATION">Declarations</option>
                    <option value="EXPRESSION">Expressions</option>
                    <option value="STATEMENT">Statements</option>
                    <option value="IDENTIFIER">Identifiers</option>
                    <option value="LITERAL">Literals</option>
                  </select>
                </div>
              </div>

              {/* Recursive Visual Tree Pane */}
              <div className="border border-slate-150 rounded-3xl bg-slate-50 p-4 max-h-[500px] overflow-y-auto shadow-inner text-left">
                {parsedAst ? (
                  <div className="space-y-1">
                    {/* Fake root node mapping */}
                    <div className="flex items-center gap-1.5 py-1 text-slate-800 font-extrabold text-xs">
                      <span className="p-0.5 rounded cursor-pointer text-slate-500" onClick={() => toggleExpand('root')}>
                        {expandedNodes.has('root') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-[10px] uppercase">File Program Code</span>
                      <span className="text-[10px] text-slate-400 font-semibold">[Scope: Global]</span>
                    </div>

                    {expandedNodes.has('root') && (
                      <div className="pl-3 space-y-1 animate-fade-in border-l border-slate-200">
                        {parsedAst.body && parsedAst.body.length > 0 ? (
                          parsedAst.body.map((child: any, idx: number) => 
                            renderTreeNode(child, `root-body-${idx}`, 1)
                          )
                        ) : (
                          <p className="text-slate-400 text-[11px] font-mono p-4 italic">No root elements parsed in file scope.</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Activity className="mx-auto text-slate-300 animate-pulse" size={24} />
                    <p className="text-xs font-semibold">Ready to display AST compiler hierarchical tree.</p>
                  </div>
                )}
              </div>

              {/* Interactive Node Inspector Drawer */}
              <AnimatePresence>
                {selectedNode && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-left space-y-3 font-sans mt-3 animate-fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Compass className="text-indigo-600 animate-spin-slow" size={16} />
                        <div>
                          <h4 className="text-[11px] font-black text-indigo-950 uppercase tracking-widest">Active Node Inspector</h4>
                          <p className="text-[10px] text-slate-600 font-semibold">{selectedNodePath || 'Root Selector'}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setSelectedNode(null)}
                        className="text-[10px] text-indigo-600 hover:text-slate-800 font-black uppercase tracking-wider"
                      >
                        Dismiss
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Left: Metadata */}
                      <div className="md:col-span-5 bg-white p-3 rounded-xl border border-indigo-100 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 block uppercase">Node Kind / Type</div>
                        <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black tracking-wide inline-block">{selectedNode.type}</span>
                        
                        <div className="text-[10px] font-bold text-slate-400 block uppercase mt-2">Code Snippet Slices</div>
                        <div className="p-1.5 bg-slate-950 text-emerald-400 font-mono text-[10.5px] rounded border border-slate-900 truncate">
                          {code.substring(selectedNode.start, selectedNode.end) || 'n/a'}
                        </div>
                      </div>

                      {/* Right: Detailed parameters */}
                      <div className="md:col-span-7 bg-white p-3 rounded-xl border border-indigo-100 overflow-x-auto max-h-[150px]">
                        <div className="text-[10px] font-bold text-slate-400 block uppercase mb-1">ESTree Properties Dictionary</div>
                        
                        <table className="min-w-full text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-1">Property</th>
                              <th className="pb-1">Type</th>
                              <th className="pb-1">Parsed Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSelectedNodeProperties().map((prop, idx) => (
                              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="py-1 font-mono font-bold text-indigo-950">{prop.key}</td>
                                <td className="py-1 text-slate-400 font-semibold">{prop.type}</td>
                                <td className="py-1 font-mono font-bold text-indigo-700 break-words max-w-[200px]">{prop.value}</td>
                              </tr>
                            ))}
                            {getSelectedNodeProperties().length === 0 && (
                              <tr>
                                <td colSpan={3} className="py-2 text-slate-400 font-bold italic text-center text-[10px]">No auxiliary props associated with this Node.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
