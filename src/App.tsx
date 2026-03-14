/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Calculator } from './components/Calculator';
import { Database } from './components/Database';
import { Login } from './components/Login';
import { SavedRecipes } from './components/SavedRecipes';
import { INITIAL_DB } from './constants';
import { Ingredient } from './types';
import { Calculator as CalcIcon, Database as DbIcon, LogOut, Bookmark } from 'lucide-react';
import { auth, db as firestore } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, getDocs, query, writeBatch, doc, where, getDoc } from 'firebase/firestore';
import { CustomColumn } from './types';

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'calc' | 'saved' | 'db'>('calc');
  const [db, setDb] = useState<Ingredient[]>([]);
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

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (!user) {
    return <Login onLogin={() => { }} />;
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans pb-20">
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
          <SavedRecipes onLoadRecipe={handleLoadRecipe} />
        ) : (
          <Database db={db} setDb={setDb} fetchIngredients={fetchData} customColumns={customColumns} setCustomColumns={setCustomColumns} />
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-stone-200 safe-area-pb">
        <div className="max-w-3xl mx-auto flex">
          <button
            onClick={() => setActiveTab('calc')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 ${activeTab === 'calc' ? 'text-emerald-600' : 'text-stone-500'}`}
          >
            <CalcIcon size={20} />
            <span className="text-xs font-medium">Calculadora</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 ${activeTab === 'saved' ? 'text-emerald-600' : 'text-stone-500'}`}
          >
            <Bookmark size={20} />
            <span className="text-xs font-medium">Guardadas</span>
          </button>
          <button
            onClick={() => setActiveTab('db')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 ${activeTab === 'db' ? 'text-emerald-600' : 'text-stone-500'}`}
          >
            <DbIcon size={20} />
            <span className="text-xs font-medium">Registro Ingredientes</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
