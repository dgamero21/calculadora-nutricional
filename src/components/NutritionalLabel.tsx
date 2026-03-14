import { Ingredient, RecipeIngredient, CustomColumn } from '../types';
import { evaluateFormula } from '../utils';
import { DAILY_VALUES } from '../constants';
import { Download, FileImage, Layout, List, Maximize2, Settings2, Type, Palette, MoveHorizontal, Save } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { useRef, RefObject, useState } from 'react';

type LabelFormat = 'horizontal' | 'vertical' | 'lineal';

export function NutritionalLabel({
  recipe,
  db,
  customColumns = [],
  portionSize,
  productName,
  clientName,
  initialEditable = false,
  onSave,
  initialStyles,
  initialHtml,
  initialFormat
}: {
  recipe: RecipeIngredient[],
  db: Ingredient[],
  customColumns?: CustomColumn[],
  portionSize: number,
  productName: string,
  clientName?: string,
  initialEditable?: boolean,
  onSave?: (html: string, styles: any, format: LabelFormat) => void | Promise<void>,
  initialStyles?: any,
  initialHtml?: string,
  initialFormat?: LabelFormat
}) {
  const nutritionalRef = useRef<HTMLDivElement>(null);
  const referenceRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<LabelFormat>(initialFormat || 'horizontal');
  const [isEditable, setIsEditable] = useState(initialEditable);
  const [customStyles, setCustomStyles] = useState(initialStyles || {
    fontSize: 11,
    borderColor: '#000000',
    textColor: '#000000',
    width: 450
  });

  // Filter out system energy columns AND ONLY SHOW user columns that are explicitly marked for label display
  const filteredCustomColumns = customColumns.filter(col => 
    col.id && 
    !col.id.startsWith('sys_') && 
    col.showInLabel === true
  );

  const exportAsPDF = async (ref: RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width, img.height]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
        pdf.save(`${filename}.pdf`);
      };
    } catch (err) {
      console.error('Error exporting PDF:', err);
    }
  };

  const exportAsJPG = async (ref: RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    try {
      const dataUrl = await toJpeg(ref.current, { backgroundColor: '#ffffff', quality: 0.95, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting JPG:', err);
    }
  };

  const nutrients = {
    carbs: 0,
    protein: 0,
    fatTotal: 0,
    fatSat: 0,
    fatTrans: 0,
    fiber: 0,
    sodium: 0,
    water: 0,
    at: 0, // Azúcares totales
    aa: 0, // Azúcares añadidos
    custom: {} as Record<string, number>
  };

  const nutrientsPer100 = {
    carbs: 0,
    protein: 0,
    fatTotal: 0,
    fatSat: 0,
    fatTrans: 0,
    fiber: 0,
    sodium: 0,
    water: 0,
    at: 0,
    aa: 0,
    custom: {} as Record<string, number>
  };

  // Initialize custom columns
  customColumns.forEach(col => {
    nutrients.custom[col.id] = 0;
    nutrientsPer100.custom[col.id] = 0;
  });

  // Total weight across all recipe items (Σ Pesos)
  const totalIngWeight = recipe.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  recipe.forEach(item => {
    const dbIng = db.find(i => i.id === item.ingredientId);
    if (dbIng) {
      const qty = Number(item.quantityLegis) || 0;
      const w = Number(item.weight) || 0;
      // Var.Grs. = (Peso Legis. × Peso) / Σ Pesos
      const varGrs = totalIngWeight > 0 ? (qty * w) / totalIngWeight : 0;
      // factor = Var.Grs. / 100  (all nutrient data is per 100g)
      const factor = varGrs / 100;

      const carbs = evaluateFormula(dbIng.carbs, dbIng, customColumns);
      const protein = evaluateFormula(dbIng.protein, dbIng, customColumns);
      const fatTotal = evaluateFormula(dbIng.fatTotal, dbIng, customColumns);
      const fatSat = evaluateFormula(dbIng.fatSat, dbIng, customColumns);
      const fatTrans = evaluateFormula(dbIng.fatTrans, dbIng, customColumns);
      const fiber = evaluateFormula(dbIng.fiber, dbIng, customColumns);
      const sodium = evaluateFormula(dbIng.sodium, dbIng, customColumns);
      const water = evaluateFormula(dbIng.water, dbIng, customColumns);
      const at = evaluateFormula(dbIng.at, dbIng, customColumns);
      const aa = evaluateFormula(dbIng.aa, dbIng, customColumns);

      nutrients.carbs += carbs * factor;
      nutrients.protein += protein * factor;
      nutrients.fatTotal += fatTotal * factor;
      nutrients.fatSat += fatSat * factor;
      nutrients.fatTrans += fatTrans * factor;
      nutrients.fiber += fiber * factor;
      nutrients.sodium += sodium * factor;
      nutrients.water += water * factor;
      nutrients.at += at * factor;
      nutrients.aa += aa * factor;

      // Calculate custom columns
      customColumns.forEach(col => {
        let val = 0;
        if (col.type === 'formula') {
          val = evaluateFormula(col.formula || '', dbIng, customColumns);
        } else if (col.type === 'manual') {
          val = Number(dbIng[col.id]) || 0;
        }
        nutrients.custom[col.id] += val * factor;
      });
    }
  });

  // Calculate per 100g based on the portion size
  const pSize = Number(portionSize) || 0;
  const per100Factor = pSize > 0 ? 100 / pSize : 0;
  nutrientsPer100.carbs = nutrients.carbs * per100Factor;
  nutrientsPer100.protein = nutrients.protein * per100Factor;
  nutrientsPer100.fatTotal = nutrients.fatTotal * per100Factor;
  nutrientsPer100.fatSat = nutrients.fatSat * per100Factor;
  nutrientsPer100.fatTrans = nutrients.fatTrans * per100Factor;
  nutrientsPer100.fiber = nutrients.fiber * per100Factor;
  nutrientsPer100.sodium = nutrients.sodium * per100Factor;
  nutrientsPer100.water = nutrients.water * per100Factor;
  nutrientsPer100.at = nutrients.at * per100Factor;
  nutrientsPer100.aa = nutrients.aa * per100Factor;

  customColumns.forEach(col => {
    nutrientsPer100.custom[col.id] = nutrients.custom[col.id] * per100Factor;
  });

  const formatVal = (val: number, isSodium = false) => {
    if (val < 0.05) return "0";
    // Si la regla de decimales no aplica para Sodio (mg) o quieres ser estricto
    // Pero la solicitud del usuario es general: números > 10 sin decimal (redondear arriba). 
    if (val >= 10) return Math.ceil(val).toString();
    return val.toLocaleString('es-AR', { maximumFractionDigits: 1 });
  };

  const calcVD = (val: number, vd: number) => {
    if (val === 0) return "0";
    return Math.round((val / vd) * 100).toString();
  };

  return (
    <div className="space-y-8">

      {/* Sección: Información Nutricional */}
      <div id="tour-label-section" className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-stone-800">Información Nutricional</h3>
            <div className="flex bg-stone-100 p-1 rounded-lg gap-1">
              <button
                onClick={() => {
                  setFormat('horizontal');
                  setCustomStyles(prev => ({ ...prev, width: 400 }));
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${format === 'horizontal' ? 'bg-white shadow-sm text-emerald-700' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Layout size={14} /> Horizontal
              </button>
              <button
                onClick={() => {
                  setFormat('vertical');
                  setCustomStyles(prev => ({ ...prev, width: 450 }));
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${format === 'vertical' ? 'bg-white shadow-sm text-emerald-700' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Maximize2 size={14} /> Vertical
              </button>
              <button
                onClick={() => {
                  setFormat('lineal');
                  setCustomStyles(prev => ({ ...prev, width: 500 }));
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${format === 'lineal' ? 'bg-white shadow-sm text-emerald-700' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <List size={14} /> Lineal
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditable(!isEditable)}
              className={`p-2 rounded-xl transition-colors ${isEditable ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              title="Ajustes y Edición Manual"
            >
              <Settings2 size={20} />
            </button>
            <button
              onClick={() => exportAsPDF(nutritionalRef, `Rotulo_${productName || 'Producto'}`)}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-xl hover:bg-stone-700 text-sm font-medium transition-colors"
            >
              <Download size={16} />
              PDF
            </button>
            <button
              onClick={() => exportAsJPG(nutritionalRef, `Rotulo_${productName || 'Producto'}`)}
              className="flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-800 rounded-xl hover:bg-stone-300 text-sm font-medium transition-colors"
            >
              <FileImage size={16} />
              JPG
            </button>
          </div>
        </div>

        {/* Panel de Edición Manual (Discreto) */}
        {isEditable && (
          <div className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 grid grid-cols-1 sm:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                <Type size={12} /> Tamaño Fuente
              </label>
              <input
                type="number"
                value={customStyles.fontSize}
                onChange={e => setCustomStyles({ ...customStyles, fontSize: Number(e.target.value) })}
                className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                <Palette size={12} /> Color Borde
              </label>
              <input
                type="color"
                value={customStyles.borderColor}
                onChange={e => setCustomStyles({ ...customStyles, borderColor: e.target.value })}
                className="w-full h-9 p-1 bg-white border border-stone-200 rounded-lg cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                <Palette size={12} /> Color Texto
              </label>
              <input
                type="color"
                value={customStyles.textColor}
                onChange={e => setCustomStyles({ ...customStyles, textColor: e.target.value })}
                className="w-full h-9 p-1 bg-white border border-stone-200 rounded-lg cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                <MoveHorizontal size={12} /> Ancho (px)
              </label>
              <input
                type="number"
                value={customStyles.width}
                onChange={e => setCustomStyles({ ...customStyles, width: Number(e.target.value) })}
                className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div className="sm:col-span-4 flex items-center justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-emerald-600 font-medium">
                * MODO EDICIÓN ACTIVO: Haz clic en cualquier texto del rótulo para modificarlo directamente.
              </span>
              {onSave && (
                <button
                  onClick={() => onSave(nutritionalRef.current?.innerHTML || '', customStyles, format)}
                  className="flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[10px] font-bold uppercase transition-colors"
                >
                  <Save size={12} />
                  Guardar Plantilla
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto pb-4">
          {initialHtml ? (
            <div
              ref={nutritionalRef}
              className="inline-block min-w-[300px] p-4 bg-white"
              contentEditable={isEditable}
              suppressContentEditableWarning={true}
              dangerouslySetInnerHTML={{ __html: initialHtml }}
            />
          ) : (
            <div
              ref={nutritionalRef}
              className="inline-block min-w-[300px] p-4 bg-white"
              contentEditable={isEditable}
              suppressContentEditableWarning={true}
            >
              <>
                {format === 'horizontal' && (
                  <div
                    contentEditable={isEditable}
                    suppressContentEditableWarning={true}
                    className="p-2 font-sans bg-white border-2 border-black"
                    style={{
                      color: customStyles.textColor,
                      width: `${customStyles.width}px`,
                      fontSize: `${customStyles.fontSize}px`
                    }}
                  >
                    <div className="text-center pt-1 pb-1 mb-1">
                      <div className="font-bold text-[18px] tracking-tight leading-none mb-1 text-black">INFORMACIÓN NUTRICIONAL</div>
                      <div className="font-bold text-[13px] leading-tight text-black">Porción: {portionSize > 0 ? formatVal(Number(portionSize)) : "0"} g</div>
                    </div>

                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b-2 border-t-2 border-black">
                          <th className="py-1 font-bold text-left">Cantidad</th>
                          <th className="py-1 font-bold text-right pr-4">Por porción</th>
                          <th className="py-1 font-bold text-right w-12">%VD (*)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="py-1">Valor energético</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.carbs * 4 + nutrients.protein * 4 + nutrients.fatTotal * 9)} kcal = {Math.ceil((nutrients.carbs * 4 + nutrients.protein * 4 + nutrients.fatTotal * 9) * 4.2)} kJ</td>
                          <td className="py-1 text-right w-12">{calcVD(nutrients.carbs * 4 + nutrients.protein * 4 + nutrients.fatTotal * 9, 2000)}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1">Carbohidratos, de los cuales:</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.carbs)} g</td>
                          <td className="py-1 text-right w-12">{calcVD(nutrients.carbs, DAILY_VALUES.carbs)}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1 pl-4">Azúcares totales</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.at)} g</td>
                          <td className="py-1 text-right w-12"></td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1 pl-4">Azúcares añadidos</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.aa)} g</td>
                          <td className="py-1 text-right w-12"></td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1">Proteínas</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.protein)} g</td>
                          <td className="py-1 text-right w-12">{calcVD(nutrients.protein, DAILY_VALUES.protein)}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1">Grasas totales, de las cuales:</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.fatTotal)} g</td>
                          <td className="py-1 text-right w-12">{calcVD(nutrients.fatTotal, DAILY_VALUES.fatTotal)}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1 pl-4">Grasas saturadas</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.fatSat)} g</td>
                          <td className="py-1 text-right w-12">{calcVD(nutrients.fatSat, DAILY_VALUES.fatSat)}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1 pl-4">Grasas trans</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.fatTrans)} g</td>
                          <td className="py-1 text-right w-12"></td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1">Fibra alimentaria</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.fiber)} g</td>
                          <td className="py-1 text-right w-12">{calcVD(nutrients.fiber, DAILY_VALUES.fiber)}</td>
                        </tr>
                        <tr className="border-b-2 border-black">
                          <td className="py-1">Sodio</td>
                          <td className="py-1 text-right pr-4">{formatVal(nutrients.sodium)} mg</td>
                          <td className="py-1 text-right w-12">{calcVD(nutrients.sodium, DAILY_VALUES.sodium)}</td>
                        </tr>
                        {filteredCustomColumns.map(col => (
                          <tr key={col.id} className="border-b border-black">
                            <td className="py-1">{col.name}</td>
                            <td className="py-1 text-right pr-4">{formatVal(nutrients.custom[col.id])} {col.unit}</td>
                            <td className="py-1 text-right w-12"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="text-[9px] leading-tight pt-1 text-stone-600 font-bold">
                      (*) % VALORES DIARIOS CON BASE A UNA DIETA DE 2.000 kcal U 8.400 kJ. SUS VALORES DIARIOS PUEDEN SER MAYORES O MENORES DEPENDIENDO DE SUS NECESIDADES ENERGÉTICAS.
                    </div>
                  </div>
                )}

                {format === 'vertical' && (
                  <div
                    contentEditable={isEditable}
                    suppressContentEditableWarning={true}
                    className="border-2 font-sans uppercase"
                    style={{
                      borderColor: customStyles.borderColor,
                      color: customStyles.textColor,
                      backgroundColor: '#ffffff',
                      width: `${customStyles.width}px`,
                      fontSize: `${customStyles.fontSize}px`
                    }}
                  >
                    <div className="text-center border-b-2 py-1" style={{ borderColor: customStyles.borderColor }}>
                      <div className="font-bold text-2xl tracking-tighter">INFORMACIÓN NUTRICIONAL</div>
                      <div className="text-lg">PORCIÓN {formatVal(Number(portionSize) || 0)} g (1 unidad)</div>
                    </div>

                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2" style={{ borderColor: customStyles.borderColor }}>
                          <th className="border-r p-1 w-1/3" style={{ borderColor: customStyles.borderColor }}></th>
                          <th className="border-r p-1 text-center leading-tight" style={{ borderColor: customStyles.borderColor }}>CANTIDAD<br />POR 100 g</th>
                          <th className="border-r p-1 text-center leading-tight" style={{ borderColor: customStyles.borderColor }}>CANTIDAD<br />POR PORCIÓN</th>
                          <th className="p-1 text-center">% VD(*)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 font-bold" style={{ borderColor: customStyles.borderColor }}>CARBOHIDRATOS</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.carbs)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.carbs)} g</td>
                          <td className="p-1 text-center">{calcVD(nutrients.carbs, DAILY_VALUES.carbs)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 pl-2 italic" style={{ borderColor: customStyles.borderColor }}>DE LOS CUALES,</td>
                          <td className="border-r p-1" style={{ borderColor: customStyles.borderColor }}></td>
                          <td className="border-r p-1" style={{ borderColor: customStyles.borderColor }}></td>
                          <td className="p-1"></td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 pl-4 font-bold" style={{ borderColor: customStyles.borderColor }}>AZÚCARES TOTALES</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.at)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.at)} g</td>
                          <td className="p-1 text-center">{calcVD(nutrients.at, DAILY_VALUES.at)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 pl-4 font-bold" style={{ borderColor: customStyles.borderColor }}>AZÚCARES AÑADIDOS</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.aa)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.aa)} g</td>
                          <td className="p-1 text-center">{calcVD(nutrients.aa, DAILY_VALUES.aa)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 font-bold" style={{ borderColor: customStyles.borderColor }}>PROTEÍNAS</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.protein)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.protein)} g</td>
                          <td className="p-1 text-center">{calcVD(nutrients.protein, DAILY_VALUES.protein)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 font-bold" style={{ borderColor: customStyles.borderColor }}>GRASAS TOTALES</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.fatTotal)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.fatTotal)} g</td>
                          <td className="p-1 text-center">{calcVD(nutrients.fatTotal, DAILY_VALUES.fatTotal)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 font-bold" style={{ borderColor: customStyles.borderColor }}>GRASAS SATURADAS</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.fatSat)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.fatSat)} g</td>
                          <td className="p-1 text-center">{calcVD(nutrients.fatSat, DAILY_VALUES.fatSat)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 font-bold" style={{ borderColor: customStyles.borderColor }}>GRASAS TRANS</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.fatTrans)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.fatTrans)} g</td>
                          <td className="p-1 text-center">-</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 font-bold" style={{ borderColor: customStyles.borderColor }}>FIBRA ALIMENTARIA</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.fiber)} g</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.fiber)} g</td>
                          <td className="p-1 text-center">{calcVD(nutrients.fiber, DAILY_VALUES.fiber)}</td>
                        </tr>
                        <tr className="border-b-2" style={{ borderColor: customStyles.borderColor }}>
                          <td className="border-r p-1 font-bold" style={{ borderColor: customStyles.borderColor }}>SODIO</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.sodium)} mg</td>
                          <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.sodium)} mg</td>
                          <td className="p-1 text-center">{calcVD(nutrients.sodium, DAILY_VALUES.sodium)}</td>
                        </tr>
                        {filteredCustomColumns.map((col, idx) => (
                          <tr key={col.id} className={idx === filteredCustomColumns.length - 1 ? "border-b-2" : "border-b"} style={{ borderColor: customStyles.borderColor }}>
                            <td className="border-r p-1 font-bold uppercase" style={{ borderColor: customStyles.borderColor }}>{col.name}</td>
                            <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrientsPer100.custom[col.id])} {col.unit}</td>
                            <td className="border-r p-1 text-center" style={{ borderColor: customStyles.borderColor }}>{formatVal(nutrients.custom[col.id])} {col.unit}</td>
                            <td className="p-1 text-center">-</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-1 text-[10px] leading-tight font-bold">
                      (*) % VALORES DIARIOS CON BASE A UNA DIETA DE 2.000 kcal U 8.400 kJ. SUS VALORES DIARIOS PUEDEN SER MAYORES O MENORES DEPENDIENDO DE SUS NECESIDADES ENERGÉTICAS.
                    </div>
                  </div>
                )}

                {format === 'lineal' && (
                  <div
                    contentEditable={isEditable}
                    suppressContentEditableWarning={true}
                    className="border-2 p-2 font-sans leading-relaxed"
                    style={{
                      borderColor: customStyles.borderColor,
                      color: customStyles.textColor,
                      backgroundColor: '#ffffff',
                      width: `${customStyles.width}px`,
                      fontSize: `${customStyles.fontSize}px`
                    }}
                  >
                    <span className="font-bold">Información Nutricional:</span> Porción {formatVal(Number(portionSize) || 0)}g.
                    Carbohidratos {formatVal(nutrients.carbs)} g ({calcVD(nutrients.carbs, DAILY_VALUES.carbs)}%VD*);
                    Azúcares Totales {formatVal(nutrients.at)} g ({calcVD(nutrients.at, DAILY_VALUES.at)}%VD*);
                    Azúcares Añadidos {formatVal(nutrients.aa)} g ({calcVD(nutrients.aa, DAILY_VALUES.aa)}%VD*);
                    Proteínas {formatVal(nutrients.protein)} g ({calcVD(nutrients.protein, DAILY_VALUES.protein)}%VD*);
                    Grasas totales {formatVal(nutrients.fatTotal)} g ({calcVD(nutrients.fatTotal, DAILY_VALUES.fatTotal)}%VD*);
                    Grasas saturadas {formatVal(nutrients.fatSat)} g ({calcVD(nutrients.fatSat, DAILY_VALUES.fatSat)}%VD*);
                    Grasas trans {formatVal(nutrients.fatTrans)} g;
                    Fibra alimentaria {formatVal(nutrients.fiber)} g ({calcVD(nutrients.fiber, DAILY_VALUES.fiber)}%VD*);
                    Sodio {formatVal(nutrients.sodium)} mg ({calcVD(nutrients.sodium, DAILY_VALUES.sodium)}%VD*).
                    {filteredCustomColumns.length > 0 && filteredCustomColumns.map(col => ` ${col.name} ${formatVal(nutrients.custom[col.id])} ${col.unit};`)}
                    <div className="text-[9px] mt-2 border-t pt-1" style={{ borderColor: customStyles.borderColor }}>
                      * % Valores Diarios con base a una dieta de 2.000 kcal u 8.400 kJ. Sus valores diarios pueden ser mayores o menores dependiendo de sus necesidades energéticas.
                    </div>
                  </div>
                )}
              </>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
