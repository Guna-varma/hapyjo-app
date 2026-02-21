import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { parseSurveyFileContent, computeWorkVolume } from '@/lib/surveyParser';
import { generateId } from '@/lib/id';
import { Plus, MapPin, Calendar, CheckCircle } from 'lucide-react-native';

export function SurveysScreen() {
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const { sites, surveys, siteAssignments, addSurvey, updateSurvey, loading } = useMockAppStore();
  const isSurveyor = user?.role === 'surveyor';
  const isAssistantSupervisor = user?.role === 'assistant_supervisor';
  const mySiteIds = (user?.id ? siteAssignments.filter((a) => a.userId === user.id).map((a) => a.siteId) : []) as string[];

  const mySurveys = surveys.filter((s) => s.surveyorId === user?.id);
  const submittedSurveys = isAssistantSupervisor
    ? surveys.filter((s) => s.status === 'submitted' && mySiteIds.includes(s.siteId))
    : [];
  const approvedSurveys = surveys.filter((s) => s.status === 'approved');

  const [newModalVisible, setNewModalVisible] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [parsedVolume, setParsedVolume] = useState<number | null>(null);
  const [beforeCount, setBeforeCount] = useState(0);
  const [afterCount, setAfterCount] = useState(0);

  const runParse = () => {
    const beforePoints = parseSurveyFileContent(beforeText);
    const afterPoints = parseSurveyFileContent(afterText);
    const volume = computeWorkVolume(beforePoints, afterPoints);
    setBeforeCount(beforePoints.length);
    setAfterCount(afterPoints.length);
    setParsedVolume(volume);
  };

  const submitNewSurvey = () => {
    const beforePoints = parseSurveyFileContent(beforeText);
    const afterPoints = parseSurveyFileContent(afterText);
    const volume = computeWorkVolume(beforePoints, afterPoints);
    const site = sites.find((s) => s.id === siteId);
    if (!site || !user?.id) return;
    addSurvey({
      id: generateId('sv'),
      type: 'Before/After Survey',
      siteId,
      siteName: site.name,
      surveyorId: user.id,
      measurements: {},
      status: 'submitted',
      createdAt: new Date().toISOString(),
      beforeFileContent: beforeText,
      afterFileContent: afterText,
      workVolume: volume,
    });
    setNewModalVisible(false);
    setBeforeText('');
    setAfterText('');
    setParsedVolume(null);
  };

  const approveSurvey = (surveyId: string) => {
    if (!user?.id) return;
    updateSurvey(surveyId, {
      status: 'approved',
      approvedById: user.id,
      approvedAt: new Date().toISOString(),
    });
  };

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const statusVariant = { draft: 'default' as const, submitted: 'warning' as const, approved: 'success' as const };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Surveys"
        subtitle={isSurveyor ? 'Submit and view your surveys' : isAssistantSupervisor ? 'Approve submitted surveys for your sites' : 'View approved surveys'}
        rightAction={
          isSurveyor && sites.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setSiteId(sites[0]?.id ?? '');
                setBeforeText('');
                setAfterText('');
                setParsedVolume(null);
                setNewModalVisible(true);
              }}
              className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center"
            >
              <Plus size={18} color="#fff" />
              <Text className="text-white font-semibold ml-1">New</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-3">Loading surveys...</Text>
          </View>
        ) : isSurveyor ? (
          <>
            <Text className="text-lg font-bold text-gray-900 mb-2">My surveys</Text>
            {mySurveys.length === 0 && <Text className="text-gray-500 py-4">No surveys yet. Tap New to add one.</Text>}
            {mySurveys.map((s) => (
              <Card key={s.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="font-semibold text-gray-900">{s.type}</Text>
                  <Badge variant={statusVariant[s.status]} size="sm">{s.status}</Badge>
                </View>
                <View className="flex-row items-center mb-1">
                  <MapPin size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.siteName}</Text>
                </View>
                <View className="flex-row items-center mb-1">
                  <Calendar size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.createdAt.slice(0, 10)}</Text>
                </View>
                {s.workVolume != null && (
                  <Text className="text-sm font-medium text-gray-700 mt-1">Work volume: {s.workVolume.toFixed(2)}</Text>
                )}
              </Card>
            ))}
          </>
        ) : (
          <>
            {isAssistantSupervisor && (
              <>
                <Text className="text-lg font-bold text-gray-900 mb-2">Submitted (to approve)</Text>
                {submittedSurveys.length === 0 && (
                  <Text className="text-gray-500 py-4">No surveys waiting for approval.</Text>
                )}
                {submittedSurveys.map((s) => (
                  <Card key={s.id} className="mb-3">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="font-semibold text-gray-900">{s.type}</Text>
                      <Badge variant="warning" size="sm">submitted</Badge>
                    </View>
                    <View className="flex-row items-center mb-1">
                      <MapPin size={14} color="#6B7280" />
                      <Text className="text-sm text-gray-600 ml-1">{s.siteName}</Text>
                    </View>
                    {s.workVolume != null && (
                      <Text className="text-sm text-gray-700 mb-2">Work volume: {s.workVolume.toFixed(2)}</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => approveSurvey(s.id)}
                      className="bg-green-600 rounded-lg py-2 flex-row items-center justify-center mt-2"
                    >
                      <CheckCircle size={18} color="#fff" />
                      <Text className="text-white font-semibold ml-2">Approve</Text>
                    </TouchableOpacity>
                  </Card>
                ))}
                <Text className="text-lg font-bold text-gray-900 mb-2 mt-4">Approved surveys</Text>
              </>
            )}
            {!isAssistantSupervisor && (
              <Text className="text-lg font-bold text-gray-900 mb-2">Approved surveys</Text>
            )}
            {approvedSurveys.length === 0 && (
              <Text className="text-gray-500 py-4">No approved surveys.</Text>
            )}
            {approvedSurveys.map((s) => (
              <Card key={s.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="font-semibold text-gray-900">{s.type}</Text>
                  <Badge variant="success" size="sm">approved</Badge>
                </View>
                <View className="flex-row items-center mb-1">
                  <MapPin size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.siteName}</Text>
                </View>
                {s.workVolume != null && (
                  <Text className="text-sm text-gray-700">Work volume: {s.workVolume.toFixed(2)}</Text>
                )}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={newModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6 max-h-[90%]">
            <ScrollView>
              <Text className="text-lg font-bold mb-4">New survey (Before/After)</Text>
              <Text className="text-sm text-gray-600 mb-1">Site</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {sites.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setSiteId(s.id)}
                    className={`px-3 py-2 rounded-lg ${siteId === s.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={siteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-sm text-gray-600 mb-1">Before file (paste CSV: pointId,x,y,elevation,...)</Text>
              <TextInput
                value={beforeText}
                onChangeText={(t) => { setBeforeText(t); setParsedVolume(null); }}
                placeholder="pt0,4746483.0150,492544.8142,1419.0430,..."
                multiline
                numberOfLines={4}
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white min-h-[80px]"
              />
              <Text className="text-sm text-gray-600 mb-1">After file (same format)</Text>
              <TextInput
                value={afterText}
                onChangeText={(t) => { setAfterText(t); setParsedVolume(null); }}
                placeholder="pt0,4746486.3917,492580.3485,1417.6798,..."
                multiline
                numberOfLines={4}
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white min-h-[80px]"
              />
              <TouchableOpacity onPress={runParse} className="bg-gray-700 rounded-lg py-2 mb-3 items-center">
                <Text className="text-white font-semibold">Parse & compute volume</Text>
              </TouchableOpacity>
              {parsedVolume !== null && (
                <View className="mb-4 p-3 bg-gray-100 rounded-lg">
                  <Text className="text-sm text-gray-700">Before points: {beforeCount} · After points: {afterCount}</Text>
                  <Text className="text-base font-semibold text-gray-900 mt-1">Work volume: {parsedVolume.toFixed(2)}</Text>
                </View>
              )}
            </ScrollView>
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity onPress={() => setNewModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitNewSurvey}
                className="flex-1 py-3 rounded-lg bg-blue-600 items-center"
              >
                <Text className="font-semibold text-white">Submit survey</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
