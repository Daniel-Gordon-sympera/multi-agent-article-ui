/**
 * Column definitions must keep a stable identity: TanStack's `flexRender` treats a new inline
 * `cell` function as a new component type and remounts every cell (losing dialog and button
 * state) each time the columns array is rebuilt. Values that change while the table is on
 * screen (polled progress, the ticking clock, handlers) therefore reach the cells through a
 * React context instead of closures.
 */
import { createContext, useContext, type Provider } from "react";

export interface ColumnContext<T> {
  Provider: Provider<T | null>;
  useColumnContext: () => T;
}

export function createColumnContext<T>(name: string): ColumnContext<T> {
  const Context = createContext<T | null>(null);
  return {
    Provider: Context.Provider,
    useColumnContext: () => {
      const value = useContext(Context);
      if (value === null) throw new Error(`${name} cells need their context provider`);
      return value;
    },
  };
}
