import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { MapPin, Calendar, Camera, Plus } from 'lucide-react-native';

export function SurveyorDashboard() {
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const { surveys } = useMockAppStore();
  const mySurveys = surveys.filter((survey) => survey.surveyorId === user?.id);

  const statusVariant = {
    draft: 'default' as const,
    submitted: 'warning' as const,
    approved: 'success' as const,
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Survey Dashboard"
        subtitle={`Welcome, ${user?.name}`}
        rightAction={
          <TouchableOpacity className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center">
            <Plus size={18} color="#ffffff" />
            <Text className="text-white font-semibold ml-1">New</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {/* Quick Stats */}
        <View className="flex-row mb-4 gap-3">
          <Card className="flex-1 bg-blue-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'draft').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">Drafts</Text>
            </View>
          </Card>
          <Card className="flex-1 bg-yellow-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'submitted').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">Submitted</Text>
            </View>
          </Card>
          <Card className="flex-1 bg-green-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'approved').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">Approved</Text>
            </View>
          </Card>
        </View>

        {/* Recent Surveys */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Recent Surveys</Text>
          {mySurveys.map((survey) => (
            <Card key={survey.id} className="mb-3">
              <View className="flex-row items-start justify-between mb-2">
                <Text className="text-base font-bold text-gray-900 flex-1">{survey.type}</Text>
                <Badge variant={statusVariant[survey.status]} size="sm">
                  {survey.status}
                </Badge>
              </View>

              <View className="flex-row items-center mb-2">
                <MapPin size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1">{survey.siteName}</Text>
              </View>

              <View className="flex-row items-center mb-3">
                <Calendar size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1">{survey.createdAt}</Text>
              </View>

              {survey.location && (
                <View className="bg-gray-50 rounded p-2 mb-3">
                  <Text className="text-xs text-gray-600">
                    GPS: {survey.location.latitude.toFixed(4)}, {survey.location.longitude.toFixed(4)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between pt-3 border-t border-gray-200">
                <View className="flex-row items-center">
                  <Camera size={14} color="#6B7280" />
                  <Text className="text-xs text-gray-600 ml-1">
                    {survey.photos?.length || 0} photos
                  </Text>
                </View>
                {survey.status === 'draft' && (
                  <TouchableOpacity>
                    <Text className="text-sm text-blue-600 font-semibold">Continue</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </View>

        {/* Quick Actions */}
        <Card className="bg-blue-600 mb-4">
          <View className="py-2">
            <Text className="text-white font-bold text-base mb-3">Quick Actions</Text>
            <Button variant="outline" className="bg-white mb-2">
              <Text className="text-blue-600 font-semibold">Start New Survey</Text>
            </Button>
            <Button variant="outline" className="bg-white">
              <Text className="text-blue-600 font-semibold">View Site Maps</Text>
            </Button>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
