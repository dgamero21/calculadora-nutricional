
import * as fs from 'fs';

const data = fs.readFileSync('./raw_data.txt', 'utf8');

function parseVal(val: string) {
    if (!val || val.trim() === "") {
        return 0;
    }
    const trimmed = val.trim();
    if (trimmed.startsWith('=')) {
        return trimmed;
    }
    try {
        const num = parseFloat(trimmed.replace(',', '.'));
        return isNaN(num) ? 0 : num;
    } catch {
        return 0;
    }
}

const lines = data.trim().split('\n');
const ingredients = [];
const seenNames = new Set();

for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 4) continue;
    
    const name = parts[0].trim();
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);
    
    const kcal = parseVal(parts[1] || "0");
    const kj = parseVal(parts[2] || "0");
    const carbs = parseVal(parts[3] || "0");
    const protein = parseVal(parts[4] || "0");
    const fatTotal = parseVal(parts[5] || "0");
    const fatSat = parseVal(parts[6] || "0");
    const fatTrans = parseVal(parts[7] || "0");
    const fiber = parseVal(parts[8] || "0");
    const sodium = parseVal(parts[9] || "0");
    const water = parseVal(parts[10] || "0");
    const at = parseVal(parts[11] || "0");
    const aa = parseVal(parts[12] || "0");
    
    ingredients.push({
        id: (ingredients.length + 1).toString(),
        name,
        unit: 100,
        kcal,
        kj,
        carbs,
        protein,
        fatTotal,
        fatSat,
        fatTrans,
        fiber,
        sodium,
        water,
        at,
        aa
    });
}

const output = `import { Ingredient } from './types';

export const INITIAL_DB: Ingredient[] = ${JSON.stringify(ingredients, null, 2)};

export const DAILY_VALUES = {
  kcal: 2000,
  carbs: 300,
  protein: 75,
  fatTotal: 55,
  fatSat: 22,
  fiber: 25,
  sodium: 2400,
};
`;

fs.writeFileSync('./src/constants.ts', output);
console.log('Successfully updated src/constants.ts');
