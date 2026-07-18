import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useListInstances, useCreateInstance, Instance } from '@workspace/api-client-react';

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
