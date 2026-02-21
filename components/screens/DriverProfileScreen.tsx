import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { User, Mail, Phone } from 'lucide-react-native';

export function DriverProfileScreen({ onBack }: { onBack?: () => void }) {
  const { user: authUser, refreshUser } = useAuth();
  const theme = useResponsiveTheme();
  const { users, updateUser } = useMockAppStore();
  const storeUser = authUser ? users.find((u) => u.id === authUser.id) : null;
  const user = storeUser ?? authUser;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const handleSave = () => {
    if (!user) return;
    const updated = { ...user, name: name.trim(), phone: phone.trim() || undefined };
    updateUser(user.id, { name: updated.name, phone: updated.phone });
    refreshUser(updated);
    setEditing(false);
  };

  if (!user) return null;

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Personal info"
        subtitle="Name, email, phone"
        leftAction={
          onBack ? (
            <TouchableOpacity onPress={onBack}>
              <Text className="text-blue-600 font-semibold">Back</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        <Card className="mb-4">
          <View className="items-center py-4">
            <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-3">
              <User size={40} color="#2563EB" />
            </View>
            {!editing ? (
              <>
                <Text className="text-xl font-bold text-gray-900">{user.name}</Text>
                <View className="flex-row items-center mt-2">
                  <Mail size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-2">{user.email}</Text>
                </View>
                {user.phone && (
                  <View className="flex-row items-center mt-1">
                    <Phone size={14} color="#6B7280" />
                    <Text className="text-sm text-gray-600 ml-2">{user.phone}</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => { setName(user.name); setPhone(user.phone ?? ''); setEditing(true); }} className="mt-4 bg-blue-600 px-4 py-2 rounded-lg">
                  <Text className="text-white font-semibold">Edit</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text className="text-sm text-gray-600 mb-1 w-full">Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white w-full"
                />
                <Text className="text-sm text-gray-600 mb-1 w-full">Email (read-only)</Text>
                <TextInput value={user.email} editable={false} className="bg-gray-100 rounded-lg px-3 py-2 mb-3 w-full" />
                <Text className="text-sm text-gray-600 mb-1 w-full">Phone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+250 788 000 000"
                  keyboardType="phone-pad"
                  className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white w-full"
                />
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setEditing(false)} className="flex-1 py-2 rounded-lg bg-gray-200 items-center">
                    <Text className="font-semibold text-gray-700">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} className="flex-1 py-2 rounded-lg bg-blue-600 items-center">
                    <Text className="font-semibold text-white">Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
