import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useListInstances, useCreateInstance, Instance } from '@workspace/api-client-react';

/** Convert a hex color string to the "H S% L%" format used in CSS custom properties. */
function hexToHslString(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const DEFAULT_COLOR = '#6366f1';

function applyInstanceColor(hex: string | null | undefined) {
  const color = hex || DEFAULT_COLOR;
  const hsl = hexToHslString(color);
  // Slightly brighter variant for foreground accent labels
  const [h] = hsl.split(' ');
  const hslBright = `${h} ${hsl.split(' ')[1]} 75%`;
  const root = document.documentElement;
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--accent', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);
  root.style.setProperty('--sidebar-accent-foreground', hslBright);
  root.style.setProperty('--chart-1', hsl);
}

interface InstanceContextType {
  activeInstanceId: number | null;
  activeInstance: Instance | null;
  setActiveInstanceId: (id: number) => void;
  instances: Instance[];
  isLoading: boolean;
}

const InstanceContext = createContext<InstanceContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'mt-active-instance';

export function InstanceProvider({ children }: { children: ReactNode }) {
  const [activeInstanceId, setActiveInstanceIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  const { data: instances, isLoading: isLoadingInstances } = useListInstances();
  const createInstance = useCreateInstance();
  // Guard: never fire auto-create more than once per mount, even across re-renders
  const creatingRef = useRef(false);

  const setActiveInstanceId = (id: number) => {
    setActiveInstanceIdState(id);
    localStorage.setItem(LOCAL_STORAGE_KEY, id.toString());
  };

  useEffect(() => {
    if (isLoadingInstances || !instances) return;

    if (instances.length === 0) {
      // Auto-create a Default instance exactly once
      if (!creatingRef.current) {
        creatingRef.current = true;
        createInstance.mutate(
          { data: { name: 'Default', color: '#6366f1' } },
          {
            onSuccess: (newInstance) => {
              setActiveInstanceId(newInstance.id);
            },
            onError: () => {
              creatingRef.current = false; // allow one retry on error
            },
          }
        );
      }
    } else {
      // If stored instance no longer exists (e.g. was deleted), fall back to first
      const storedExists = activeInstanceId
        ? instances.some((inst) => inst.id === activeInstanceId)
        : false;
      if (!storedExists && instances[0]) {
        setActiveInstanceId(instances[0].id);
      }
    }
    // Only re-run when the instances list or loading state changes —
    // NOT on activeInstanceId or createInstance mutation state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, isLoadingInstances]);

  const activeInstance = instances?.find((i) => i.id === activeInstanceId) ?? null;

  // Keep CSS accent color in sync with the active instance's color
  useEffect(() => {
    applyInstanceColor(activeInstance?.color);
  }, [activeInstance?.color]);

  return (
    <InstanceContext.Provider
      value={{
        activeInstanceId,
        activeInstance,
        setActiveInstanceId,
        instances: instances ?? [],
        isLoading: isLoadingInstances,
      }}
    >
      {children}
    </InstanceContext.Provider>
  );
}

const DEFAULT_CONTEXT: InstanceContextType = {
  activeInstanceId: null,
  activeInstance: null,
  setActiveInstanceId: () => {},
  instances: [],
  isLoading: true,
};

export function useInstance() {
  return useContext(InstanceContext) ?? DEFAULT_CONTEXT;
}
