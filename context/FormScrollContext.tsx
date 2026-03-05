import React, { createContext, useContext, useRef, useCallback } from 'react';
import type { ScrollView } from 'react-native';

type FormScrollContextValue = {
  scrollViewRef: React.RefObject<ScrollView | null>;
  scrollToFocusedInput: (inputY: number, inputHeight: number) => void;
};

const FormScrollContext = createContext<FormScrollContextValue | null>(null);

const FOCUS_OFFSET_TOP = 80;
const KEYBOARD_SAFE_PADDING_BOTTOM_MIN = 120;
const KEYBOARD_SAFE_PADDING_BOTTOM_MAX = 300;

export function useFormScroll() {
  const ctx = useContext(FormScrollContext);
  return ctx;
}

export function FormScrollProvider({
  children,
  scrollViewRef,
}: {
  children: React.ReactNode;
  scrollViewRef: React.RefObject<ScrollView | null>;
}) {
  const scrollToFocusedInput = useCallback(
    (inputY: number, inputHeight: number) => {
      const scrollRef = scrollViewRef?.current;
      if (!scrollRef || !scrollRef.scrollTo) return;
      const targetY = Math.max(0, inputY - FOCUS_OFFSET_TOP);
      scrollRef.scrollTo({ y: targetY, animated: true });
    },
    [scrollViewRef]
  );

  const value: FormScrollContextValue = {
    scrollViewRef,
    scrollToFocusedInput,
  };

  return (
    <FormScrollContext.Provider value={value}>
      {children}
    </FormScrollContext.Provider>
  );
}

export function getKeyboardSafePaddingBottom(height: number): number {
  const ratio = height < 600 ? 0.35 : height < 800 ? 0.25 : 0.2;
  const padding = Math.round(height * ratio);
  return Math.min(KEYBOARD_SAFE_PADDING_BOTTOM_MAX, Math.max(KEYBOARD_SAFE_PADDING_BOTTOM_MIN, padding));
}
