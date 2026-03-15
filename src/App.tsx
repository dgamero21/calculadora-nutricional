/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, Fragment } from 'react';
import { Calculator } from './components/Calculator';
import { Database } from './components/Database';
import { Login } from './components/Login';
import { SavedRecipes } from './components/SavedRecipes';
import { ConfirmModal } from './components/ConfirmModal';
import { INITIAL_DB } from './constants';
import { Ingredient } from './types';
import { Calculator as CalcIcon, Database as DbIcon, LogOut, Bookmark } from 'lucide-react';
import { auth, db as firestore } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, getDocs, query, writeBatch, doc, where, getDoc } from 'firebase/firestore';
import { CustomColumn } from './types';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Columnas predeterminadas del sistema para todos los usuarios (no editables)
const DEFAULT_ENERGY_COLUMNS: CustomColumn[] = [
  {
    id: 'sys_energia_kcal',
    name: 'Energía Kcal',
    code: 'energia_kcal',
    unit: 'kcal',
    type: 'formula',
    formula: 'carbs * 4 + protein * 4 + fatTotal * 9'
  },
  {
    id: 'sys_energia_kj',
    name: 'Energía kJ x 4,2',
    code: 'energia_kj',
    unit: 'kJ',
    type: 'formula',
    formula: '(carbs * 4 + protein * 4 + fatTotal * 9) * 4.2'
  }
];

// Mock data for Tutorial
const TUTORIAL_DB: Ingredient[] = [
  { id: 't1', name: 'Pan de miga blanco', unit: 100, carbs: 53, protein: 6, fatTotal: 2, fatSat: 0, fatTrans: 0, fiber: 0.1, sodium: 575, water: 33.9, at: 0, aa: 0, kj: 0, kcal: 0 },
  { id: 't2', name: 'Jamón cocido Lario', unit: 100, carbs: 0, protein: 16.5, fatTotal: 3.5, fatSat: 1.25, fatTrans: 0, fiber: 0, sodium: 740, water: 70, at: 0, aa: 0, kj: 0, kcal: 0 },
  { id: 't3', name: 'Queso tybo Masterlac', unit: 100, carbs: 0, protein: 27, fatTotal: 28, fatSat: 15.3, fatTrans: 0, fiber: 0, sodium: 956, water: 0, at: 0, aa: 0, kj: 0, kcal: 0 }
];

const TUTORIAL_SAVED: any[] = [
  {
    id: 'ts1',
    productName: 'Sándwich Clásico',
    clientName: 'Cliente Ejemplo',
    createdAt: new Date().toISOString(),
    portionSize: 150,
    ingredients: [
      { ingredientId: 't1', ingredientName: 'Pan de miga blanco', weight: 80, quantityLegis: 80, carbs: 53, protein: 6, fatTotal: 2, fatSat: 0, fatTrans: 0, fiber: 0.1, sodium: 575, water: 33.9, at: 0, aa: 0 },
      { ingredientId: 't2', ingredientName: 'Jamón cocido Lario', weight: 40, quantityLegis: 40, carbs: 0, protein: 16.5, fatTotal: 3.5, fatSat: 1.25, fatTrans: 0, fiber: 0, sodium: 740, water: 70, at: 0, aa: 0 },
      { ingredientId: 't3', ingredientName: 'Queso tybo Masterlac', weight: 30, quantityLegis: 30, carbs: 0, protein: 27, fatTotal: 28, fatSat: 15.3, fatTrans: 0, fiber: 0, sodium: 956, water: 0, at: 0, aa: 0 }
    ]
  },
  {
    id: 'ts2',
    productName: 'Mezcla Premium',
    clientName: 'Gourmet SA',
    createdAt: new Date().toISOString(),
    portionSize: 100,
    ingredients: []
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isTourMode, setIsTourMode] = useState(false);
  const [showTourExitConfirm, setShowTourExitConfirm] = useState(false);
  const driverObjRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState<'calc' | 'saved' | 'db'>('calc');
  const [db, setDb] = useState<Ingredient[]>(INITIAL_DB);
  const [customColumns, setCustomColumns] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [calculatorState, setCalculatorState] = useState<{
    productName: string;
    clientName: string;
    recipe: any[];
    portionSize: number;
  }>({
    productName: '',
    clientName: '',
    recipe: [],
    portionSize: 0
  });

  const handleLoadRecipe = (recipe: any) => {
    setCalculatorState({
      productName: recipe.productName || '',
      clientName: recipe.clientName || '',
      portionSize: recipe.portionSize || 0,
      recipe: recipe.ingredients ? recipe.ingredients.map((ing: any) => ({
        id: Date.now().toString() + Math.random().toString(),
        ingredientId: ing.ingredientId,
        weight: ing.weight || 0,
        quantityLegis: ing.quantityLegis || 0
      })) : []
    });
    setActiveTab('calc');
  };

  const updateCalculatorState = (newState: Partial<typeof calculatorState>) => {
    setCalculatorState(prev => ({ ...prev, ...newState }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user?.uid) return;
    if (user.uid === 'tour-user') {
      setDb([...TUTORIAL_DB, ...INITIAL_DB]); // Double safety for tutorial data
      setLoadingDb(false);
      return;
    }
    setLoadingDb(true);
    try {
      // Fetch custom columns
      try {
        const settingsDoc = await getDoc(doc(firestore, 'settings', user.uid));
        let baseCols = [];
        if (settingsDoc.exists()) {
          baseCols = settingsDoc.data().customColumns || [];
        } else {
          const localCols = localStorage.getItem(`customColumns_${user.uid}`);
          baseCols = localCols ? JSON.parse(localCols) : [];
        }

        // Prepend system default energy columns (always present, cannot be deleted)
        const userCols = baseCols.filter((c: CustomColumn) =>
          c.id !== 'sys_energia_kcal' && c.id !== 'sys_energia_kj'
        );
        setCustomColumns([...DEFAULT_ENERGY_COLUMNS, ...userCols]);
      } catch (settingsError) {
        console.warn('Could not fetch settings (permissions or missing):', settingsError);
        const localCols = localStorage.getItem(`customColumns_${user.uid}`);
        const baseCols = localCols ? JSON.parse(localCols) : [];
        const userCols = baseCols.filter((c: CustomColumn) =>
          c.id !== 'sys_energia_kcal' && c.id !== 'sys_energia_kj'
        );
        setCustomColumns([...DEFAULT_ENERGY_COLUMNS, ...userCols]);
      }

      // Fetch ingredients
      try {
        const q = query(collection(firestore, 'ingredients'), where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const parseNum = (val: any): number | string => {
            if (val === undefined || val === null) return 0;
            return val; // keep as-is (string or number), evaluateFormula handles both
          };

          const mappedDb = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,                         // grab ALL Firestore fields (custom cols, etc.)
              id: doc.id,
              name: data.name,
              unit: data.unit || 100,
              carbs: parseNum(data.carbs),
              protein: parseNum(data.protein),
              fatTotal: parseNum(data.fatTotal),
              fatSat: parseNum(data.fatSat),
              fatTrans: parseNum(data.fatTrans),
              fiber: parseNum(data.fiber),
              sodium: parseNum(data.sodium),
              water: parseNum(data.water),
              at: parseNum(data.at),
              aa: parseNum(data.aa)
            } as Ingredient;
          });


          // Sort locally to avoid needing a composite index in Firestore
          mappedDb.sort((a, b) => a.name.localeCompare(b.name));
          setDb(mappedDb);
        } else {
          setDb(INITIAL_DB);
          saveInitialDbToFirebase(INITIAL_DB);
        }
      } catch (ingError) {
        console.error('Error fetching ingredients (permissions or missing):', ingError);
        // Fallback to local state if Firestore fails
        setDb(INITIAL_DB);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingDb(false);
    }
  };

  const saveInitialDbToFirebase = async (initialDb: Ingredient[]) => {
    if (!user?.uid) return;

    try {
      const batch = writeBatch(firestore);
      initialDb.forEach(item => {
        const newDocRef = doc(collection(firestore, 'ingredients'));
        batch.set(newDocRef, {
          userId: user.uid,
          name: item.name,
          unit: item.unit || 100,
          carbs: item.carbs,
          protein: item.protein,
          fatTotal: item.fatTotal,
          fatSat: item.fatSat,
          fatTrans: item.fatTrans,
          fiber: item.fiber,
          sodium: item.sodium,
          water: item.water || 0,
          at: item.at || 0,
          aa: item.aa || 0
        });
      });
      await batch.commit();
      fetchData();
    } catch (error) {
      console.error('Error saving initial DB:', error);
    }
  };

  useEffect(() => {
    if (!isTourMode) return;

    // Listen for 'exit-tour' event from custom buttons inside popovers
    const handleExitTour = () => setShowTourExitConfirm(true);
    window.addEventListener('exit-tour', handleExitTour);

    const handleGlobalClick = (e: MouseEvent) => {
      // Detect clicks outside the active popover to show exit confirmation
      const target = e.target as HTMLElement;
      
      // Don't trigger if clicking inside the popover or the confirmation modal itself
      const isPopoverClick = target.closest('.driver-popover');
      const isConfirmModalClick = target.closest('.tour-exit-confirm-modal');
      
      if (!isPopoverClick && !isConfirmModalClick && driverObjRef.current) {
        setShowTourExitConfirm(true);
      }
    };

    // Use capture phase to intercept clicks on the overlay
    document.addEventListener('mousedown', handleGlobalClick, true);
    
    return () => {
      window.removeEventListener('exit-tour', handleExitTour);
      document.removeEventListener('mousedown', handleGlobalClick, true);
    };
  }, [isTourMode]);

  const startTour = () => {
    const tourStep = (element: string, title: string, description: string, options: any = {}) => ({
      element,
      popover: {
        title,
        description: `
          <div class="flex flex-col gap-3">
            <p>${description}</p>
            <button onclick="window.dispatchEvent(new CustomEvent('exit-tour'))" style="cursor: pointer !important; pointer-events: auto !important;" class="mt-2 text-[10px] text-stone-400 hover:text-red-500 transition-colors underline text-left w-fit">
              Saltar Tutorial
            </button>
          </div>
        `,
        ...options
      },
      ...options.stepOptions
    });

    const driverObj = driver({
      showProgress: true,
      animate: true,
      stagePadding: 5,
      stageRadius: 10,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      allowClose: false,
      disableActiveInteraction: true,
      onDestroyed: () => {
        setIsTourMode(false);
        setUser(null);
        setCalculatorState({ productName: '', clientName: '', recipe: [], portionSize: 0 });
        setActiveTab('calc');
      },
      steps: [
        tourStep('#tour-nav-calc', 'Módulo de Calculadora', 'Aquí es donde sucede la magia. Puedes crear tus recetas y mezclas en segundos.', {
          side: "top", align: 'center',
          stepOptions: {
            onHighlighted: () => setCalculatorState({ productName: '', clientName: '', recipe: [], portionSize: 0 })
          }
        }),
        tourStep('#tour-product-name', 'Nombre del Producto', 'Escribe aquí qué estás preparando para identificar tu receta.', {
          side: "bottom", align: 'start',
          stepOptions: {
            onHighlighted: () => setCalculatorState(prev => ({ ...prev, productName: 'Sándwich de Jamón y Queso' }))
          }
        }),
        tourStep('#tour-add-row', 'Agregar Matería Prima', '¡Mira cómo cargamos los ingredientes! Se añaden a la lista con sus pesos.', {
          side: "bottom", align: 'start',
          stepOptions: {
            onHighlighted: () => setCalculatorState(prev => ({
              ...prev,
              recipe: [
                { id: 'tr1', ingredientId: 't1', weight: 80, quantityLegis: 80 },
                { id: 'tr2', ingredientId: 't2', weight: 40, quantityLegis: 40 },
                { id: 'tr3', ingredientId: 't3', weight: 30, quantityLegis: 30 }
              ]
            }))
          }
        }),
        tourStep('#tour-clear-recipe', 'Botón Limpiar', '¿Quieres empezar de cero? Este botón borra todos los campos rápidamente.', {
          side: "bottom", align: 'start'
        }),
        tourStep('#tour-portion-size', 'Cálculo Automático', 'El tamaño de la porción se calcula solo sumando los pesos. ¡Ya tienes 150g!', {
          side: "bottom", align: 'start'
        }),
        tourStep('#tour-save-recipe', 'Guardar Trabajo', 'Cuando estés conforme, guarda tu receta. Al hacerlo, se enviará directamente a tu historial en "Guardadas".', {
          side: "top", align: 'start'
        }),
        tourStep('#tour-recipe-summary', 'Detalle de Aportes', 'Aquí puedes auditar cuánto aporta cada ingrediente al total (Var.Grs) y sus valores individuales.', {
          side: "top", align: 'start'
        }),
        tourStep('#tour-label-section', 'Tu Rótulo Profesional', '¡Listo! Los valores nutricionales se calculan solos y el rótulo aparece aquí listo para usar.', {
          side: "top", align: 'start'
        }),
        tourStep('#tour-nav-saved', 'Recetas Guardadas', 'Accede a todo tu historial de trabajos anteriores para editarlos o exportarlos.', {
          side: "top", align: 'center',
          onNextClick: () => {
            setActiveTab('saved');
            setTimeout(() => (driverObjRef.current as any).moveNext(), 300);
          }
        }),
        tourStep('#tour-saved-first-card', 'Tus Trabajos', 'Aquí aparecen tus recetas guardadas. Puedes abrir el detalle para ver los aportes o volver a cargarlas en la calculadora para editarlas.', {
          side: "bottom", align: 'start'
        }),
        tourStep('#tour-nav-db', 'Gestión de Base de Datos', 'Aquí configuras tus materias primas. Es el corazón de tus cálculos.', {
          side: "top", align: 'center',
          onNextClick: () => {
            setActiveTab('db');
            setTimeout(() => (driverObjRef.current as any).moveNext(), 300);
          }
        }),
        tourStep('#tour-db-search', 'Buscador de Ingredientes', 'Busca entre tus ingredientes cargados. Puedes filtrar por nombre rápidamente.', {
          side: "bottom", align: 'start'
        }),
        tourStep('#tour-db-first-row', 'Materias Primas', 'Aquí ves tus ingredientes. Puedes editarlos directamente haciendo clic en las celdas verdes.', {
          side: "bottom", align: 'start'
        }),
        tourStep('#tour-db-cols', 'Columnas Personalizadas', 'Configura las columnas que necesitas. Aquí creas las fórmulas de Energía.', {
          side: "bottom", align: 'start'
        }),
        tourStep('#tour-db-new', 'Alta y Carga Masiva', 'Añade ingredientes uno por uno o pega directamente desde Excel para una carga masiva.', {
          side: "bottom", align: 'start',
          onNextClick: () => {
            driverObj.destroy();
          }
        }),
      ]
    } as any);

    driverObjRef.current = driverObj;
    setIsTourMode(true);
    setUser({ uid: 'tour-user', email: 'invitado@nutricalc.local' } as any);
    // Combine mock data with initial data so select is never empty
    setDb([...TUTORIAL_DB, ...INITIAL_DB]);
    setLoadingDb(false);
    setActiveTab('calc'); 

    setTimeout(() => {
      driverObj.drive();
    }, 800);
  };

  const handleLogout = async () => {
    try {
      if (isTourMode) {
        setIsTourMode(false);
        setUser(null);
        setCalculatorState({ productName: '', clientName: '', recipe: [], portionSize: 0 });
        return;
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return <Login onLogin={() => { }} onStartTour={startTour} />;
  }

  return (
    <Fragment>

      <div className={`min-h-screen bg-stone-100 text-stone-900 font-sans pb-20 ${isTourMode ? 'pointer-events-none select-none' : ''}`}>
        <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
            <CalcIcon className="text-emerald-600" size={24} />
            Calculadora Nutricional
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm font-medium"
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {loadingDb ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : activeTab === 'calc' ? (
          <Calculator
            db={db}
            customColumns={customColumns}
            state={calculatorState}
            onStateChange={updateCalculatorState}
          />
        ) : activeTab === 'saved' ? (
          <SavedRecipes 
            isTourMode={isTourMode}
            tutorialData={TUTORIAL_SAVED}
            onLoadRecipe={handleLoadRecipe} 
          />
        ) : (
          <Database 
            db={db} 
            setDb={setDb} 
            fetchIngredients={fetchData} 
            customColumns={customColumns} 
            setCustomColumns={setCustomColumns} 
            isTourMode={isTourMode}
          />
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-stone-200 safe-area-pb z-50">
        <div className="max-w-3xl mx-auto flex">
          <button
            id="tour-nav-calc"
            onClick={() => setActiveTab('calc')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all tap-active ${activeTab === 'calc' ? 'text-emerald-600' : 'text-stone-500'}`}
          >
            <CalcIcon size={20} />
            <span className="text-xs font-medium">Calculadora</span>
          </button>
          <button
            id="tour-nav-saved"
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all tap-active ${activeTab === 'saved' ? 'text-emerald-600' : 'text-stone-500'}`}
          >
            <Bookmark size={20} />
            <span className="text-xs font-medium">Guardadas</span>
          </button>
          <button
            id="tour-nav-db"
            onClick={() => setActiveTab('db')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 ${activeTab === 'db' ? 'text-emerald-600' : 'text-stone-500'}`}
          >
            <DbIcon size={20} />
            <span className="text-xs font-medium">Registro Ingredientes</span>
          </button>
        </div>
      </nav>
    </div>
      {showTourExitConfirm && (
        <div className="fixed inset-0 z-[1000000001] pointer-events-auto tour-exit-confirm-modal">
          <ConfirmModal
            title="¿Salir del Tutorial?"
            message="Si sales ahora, volverás a la pantalla de inicio de sesión. ¿Deseas abandonar el recorrido?"
            confirmLabel="Salir"
            onConfirm={() => {
              driverObjRef.current?.destroy();
              setShowTourExitConfirm(false);
              handleLogout();
            }}
            onCancel={() => setShowTourExitConfirm(false)}
          />
        </div>
      )}
    </Fragment>
  );
}
