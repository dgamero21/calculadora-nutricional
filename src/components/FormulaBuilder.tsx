import React, { useState, useEffect, useRef } from 'react';
import { CustomColumn } from '../types';
import { Delete, Trash2, ArrowLeft, Plus, Minus, X as Multiply, Divide, Hash } from 'lucide-react';

interface FormulaBuilderProps {
  value: string;
  onChange: (value: string) => void;
  customColumns: CustomColumn[];
  currentColCode?: string; // To prevent circular dependency (selecting itself)
}

const BASE_VARIABLES = [
  { code: 'carbs', label: 'Hidratos de Carbono', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { code: 'protein', label: 'Proteínas', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { code: 'fatTotal', label: 'Grasas Totales', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { code: 'fatSat', label: 'Grasas Saturadas', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { code: 'fatTrans', label: 'Grasas Trans', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { code: 'fiber', label: 'Fibra', color: 'bg-green-100 text-green-800 border-green-200' },
  { code: 'sodium', label: 'Sodio', color: 'bg-stone-100 text-stone-800 border-stone-200' },
  { code: 'water', label: 'Agua', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { code: 'at', label: 'Azúcares Totales', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { code: 'aa', label: 'Azúcares Añadidos', color: 'bg-pink-50 text-pink-700 border-pink-200' },
];

export function FormulaBuilder({ value, onChange, customColumns, currentColCode }: FormulaBuilderProps) {
  const [numberInput, setNumberInput] = useState('');

  // Combine base variables with other custom columns
  const availableVariables = [
    ...BASE_VARIABLES,
    ...customColumns
      .filter(c => c.code !== currentColCode && c.code) // Exclude self and empty codes
      .map(c => ({
        code: c.code!,
        label: c.name,
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      }))
  ];

  const handleAddToken = (token: string) => {
    // Add space padding for operators to make it readable, but not for variables/numbers if possible
    // Actually, simple concatenation with spaces is safest for the user to read
    const newValue = value ? `${value} ${token}` : token;
    onChange(newValue);
  };

  const handleBackspace = () => {
    if (!value) return;
    // Try to remove the last token (split by space)
    const parts = value.trim().split(' ');
    parts.pop();
    onChange(parts.join(' '));
  };

  const handleClear = () => {
    onChange('');
  };

  const handleAddNumber = () => {
    if (!numberInput) return;
    handleAddToken(numberInput);
    setNumberInput('');
  };

  // Helper to render the formula visually
  const renderFormula = () => {
    if (!value) return <span className="text-stone-400 italic">La fórmula está vacía...</span>;

    // Split by spaces to tokenize (assuming we build it with spaces)
    // If the user typed manually, this might be a single string.
    // We'll try to split by word boundaries for display if it looks like a manual string,
    // but primarily we rely on our builder's spacing.
    const tokens = value.split(' ');

    return tokens.map((token, index) => {
      // Check if it's a variable
      const variable = availableVariables.find(v => v.code === token);
      if (variable) {
        return (
          <span key={index} className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border mx-0.5 ${variable.color}`}>
            {variable.label}
          </span>
        );
      }
      // Check if operator
      if (['+', '-', '*', '/', '(', ')'].includes(token)) {
        return (
          <span key={index} className="inline-block px-1 font-bold text-stone-600">
            {token === '*' ? '×' : token === '/' ? '÷' : token}
          </span>
        );
      }
      // Number or unknown
      return (
        <span key={index} className="inline-block px-1 font-mono text-stone-800">
          {token}
        </span>
      );
    });
  };

  return (
    <div className="space-y-3">
      {/* Visual Display */}
      <div className="min-h-[60px] p-3 bg-white border border-stone-300 rounded-xl shadow-sm flex flex-wrap items-center gap-y-2">
        {renderFormula()}
      </div>

      {/* Controls */}
      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-3">

        {/* Row 1: Variables */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">1. Seleccionar Variable</label>
          <select
            className="w-full p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
            onChange={(e) => {
              if (e.target.value) {
                handleAddToken(e.target.value);
                e.target.value = ''; // Reset
              }
            }}
          >
            <option value="">-- Elegir Columna --</option>
            <optgroup label="Nutrientes Base">
              {availableVariables.filter(v => BASE_VARIABLES.some(b => b.code === v.code)).map(v => (
                <option key={v.code} value={v.code}>{v.label}</option>
              ))}
            </optgroup>
            {availableVariables.some(v => !BASE_VARIABLES.some(b => b.code === v.code)) && (
              <optgroup label="Mis Columnas">
                {availableVariables.filter(v => !BASE_VARIABLES.some(b => b.code === v.code)).map(v => (
                  <option key={v.code} value={v.code}>{v.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Row 2: Operators & Numbers */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">2. Operador</label>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => handleAddToken('+')} className="flex-1 min-w-[36px] p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700 font-bold" title="Sumar">+</button>
              <button onClick={() => handleAddToken('-')} className="flex-1 min-w-[36px] p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700 font-bold" title="Restar">-</button>
              <button onClick={() => handleAddToken('*')} className="flex-1 min-w-[36px] p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700 font-bold" title="Multiplicar">×</button>
              <button onClick={() => handleAddToken('/')} className="flex-1 min-w-[36px] p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700 font-bold" title="Dividir">÷</button>
              <button onClick={() => handleAddToken('(')} className="flex-none px-3 p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700 font-bold">(</button>
              <button onClick={() => handleAddToken(')')} className="flex-none px-3 p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700 font-bold">)</button>
            </div>
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">3. Número</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="Ej. 100"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNumber()}
              />
              <button
                onClick={handleAddNumber}
                disabled={!numberInput}
                className="p-2 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300 disabled:opacity-50"
              >
                <Hash size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Actions */}
        <div className="flex flex-wrap justify-between sm:justify-end gap-2 pt-2 border-t border-stone-200">
          <button
            onClick={handleBackspace}
            className="flex-1 sm:flex-none justify-center px-3 py-1.5 text-stone-600 hover:bg-stone-200 rounded-lg text-sm flex items-center gap-1 transition-colors"
            title="Borrar último elemento"
          >
            <ArrowLeft size={14} /> Borrar Último
          </button>
          <button
            onClick={handleClear}
            className="flex-1 sm:flex-none justify-center px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1 transition-colors"
            title="Borrar toda la fórmula"
          >
            <Trash2 size={14} /> Limpiar Todo
          </button>
        </div>

      </div>
    </div>
  );
}
