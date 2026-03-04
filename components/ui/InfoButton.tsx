import React from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { Info } from 'lucide-react-native';
import { colors } from '@/theme/tokens';

interface InfoButtonProps {
  title: string;
  message: string;
  size?: number;
  color?: string;
}

export function InfoButton({ title, message, size = 18, color = colors.textMuted }: InfoButtonProps) {
  const onPress = () => Alert.alert(title, message);
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Info size={size} color={color} />
    </TouchableOpacity>
  );
}
