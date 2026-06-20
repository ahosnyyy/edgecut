import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";

interface HeaderActionsContextValue {
  actions: ReactNode[];
  registerAction: (key: string, node: ReactNode) => void;
  unregisterAction: (key: string) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null);

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<Map<string, ReactNode>>(new Map());

  const registerAction = useCallback((key: string, node: ReactNode) => {
    setActions((prev) => {
      const next = new Map(prev);
      next.set(key, node);
      return next;
    });
  }, []);

  const unregisterAction = useCallback((key: string) => {
    setActions((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const actionList = Array.from(actions.values());

  return (
    <HeaderActionsContext.Provider value={{ actions: actionList, registerAction, unregisterAction }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions() {
  const ctx = useContext(HeaderActionsContext);
  if (!ctx) {
    throw new Error("useHeaderActions must be used within HeaderActionsProvider");
  }
  return ctx;
}

export function useHeaderAction(key: string, node: ReactNode | null) {
  const { registerAction, unregisterAction } = useHeaderActions();
  const nodeRef = useRef(node);
  nodeRef.current = node;

  useEffect(() => {
    if (nodeRef.current === null) return;
    registerAction(key, nodeRef.current);
    return () => unregisterAction(key);
  }, [key, registerAction, unregisterAction]);
}
