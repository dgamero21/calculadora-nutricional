import { Ingredient, CustomColumn } from './types';

function parseValue(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  
  const str = val.toString().trim();
  
  // If it has a comma, assume EU/AR format (e.g. "1.234,56" or "12,34")
  if (str.includes(',')) {
    // Remove dots (thousands separators) and replace comma with dot
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    return isNaN(num) ? 0 : num;
  }
  
  // If no comma, assume standard float format (e.g. "68.38" or "100")
  // This prevents "68.38" from being treated as "6838"
  const num = Number(str);
  return isNaN(num) ? 0 : num;
}

export function evaluateFormula(formula: string | number, ingredient: Ingredient, customColumns: CustomColumn[], depth = 0): number {
  if (formula === undefined || formula === null || formula === '') return 0;
  if (typeof formula === 'number') return formula;
  
  // Try to parse as simple number first (handling comma)
  const simpleNumStr = formula.toString().replace(',', '.');
  const simpleNum = Number(simpleNumStr);
  if (!isNaN(simpleNum) && !formula.toString().includes('+') && !formula.toString().includes('*') && !formula.toString().includes('/') && !formula.toString().includes('-')) {
    return simpleNum;
  }

  // If it's a formula
  let expression = formula.toString();
  if (expression.startsWith('=')) expression = expression.substring(1);

  // 1. Build map of available variables
  const carbs = parseValue(ingredient.carbs);
  const protein = parseValue(ingredient.protein);
  const fatTotal = parseValue(ingredient.fatTotal);

  const variables: Record<string, number> = {
    carbs,
    protein,
    fatTotal,
    fatSat: parseValue(ingredient.fatSat),
    fatTrans: parseValue(ingredient.fatTrans),
    fiber: parseValue(ingredient.fiber),
    sodium: parseValue(ingredient.sodium),
    water: parseValue(ingredient.water),
    at: parseValue(ingredient.at),
    aa: parseValue(ingredient.aa),
  };

  // Add custom columns
  if (depth < 3) { // Prevent infinite recursion
    customColumns.forEach(col => {
      if (col.code) {
        if (col.type === 'manual') {
          variables[col.code] = parseValue(ingredient[col.id]);
        } else if (col.type === 'formula' && col.formula) {
          // Recursive evaluation
          variables[col.code] = evaluateFormula(col.formula, ingredient, customColumns, depth + 1);
        }
      }
    });
  }

  // 2. Replace variables in expression
  // Sort keys by length descending to avoid partial matches (e.g. replacing 'fat' inside 'fatTotal')
  const keys = Object.keys(variables).sort((a, b) => b.length - a.length);
  
  for (const key of keys) {
    // Use word boundaries to match exact variable names
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    expression = expression.replace(regex, variables[key].toString());
  }

  // 3. Handle commas in the expression (e.g. user typed "4,2")
  expression = expression.replace(/,/g, '.');

  // 4. Evaluate
  try {
    // Sanitize: allow numbers, operators, parens, dots, spaces
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    
    if (!sanitized.trim()) return 0;

    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${sanitized}`)();
    return isNaN(result) || !isFinite(result) ? 0 : result;
  } catch (e) {
    console.warn('Formula evaluation error:', e);
    return 0;
  }
}
