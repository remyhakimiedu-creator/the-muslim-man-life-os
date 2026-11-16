import { useEffect, useMemo, useReducer } from 'react';
import { sound } from '../utils/sound';
import { reducer } from './reducer';
import { loadState, saveState } from './storage';
import { StoreContext } from './context';

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState());

  // Every change is written straight to localStorage.
  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    sound.setMuted(state.settings.muted);
  }, [state.settings.muted]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
