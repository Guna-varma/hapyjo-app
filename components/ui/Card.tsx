import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <View
      className={`bg-white rounded-xl p-4 shadow-sm border border-slate-200/80 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
