import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Loader } from '@/components/ui/Loader';

type LoadingContextValue = {
  /** Show global centered loader. Call hideLoading when done. */
  showLoading: () => void;
  /** Hide global loader. */
  hideLoading: () => void;
  /** Run an async function with the global loader visible. Hides on finish or throw. */
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
  loading: boolean;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);

  const showLoading = useCallback(() => setLoading(true), []);
  const hideLoading = useCallback(() => setLoading(false), []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      try {
        const result = await fn();
        return result;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <LoadingContext.Provider value={{ showLoading, hideLoading, withLoading, loading }}>
      {children}
      {loading && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only">
          <View style={styles.overlay}>
            <Loader size={48} />
          </View>
        </View>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
