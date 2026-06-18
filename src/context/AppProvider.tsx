import { useReducer, useCallback, ReactNode } from 'react';
import AppContext, { appReducer, createInitialState } from './AppContext';
import { getColorForLength, getRGBForLength } from '../engine/colors';

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, null, createInitialState);

  const getStockById = useCallback((id: string) => {
    return state.stockLengths.find(s => s.id === id) || null;
  }, [state.stockLengths]);

  return (
    <AppContext.Provider value={{ state, dispatch, getColorForLength, getRGBForLength, getStockById }}>
      {children}
    </AppContext.Provider>
  );
}
