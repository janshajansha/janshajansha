import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TechDashboard from '../screens/technician/DashboardScreen';
import TechRequestDetail from '../screens/technician/RequestDetailScreen';
import TechProfileScreen from '../screens/technician/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TechDashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TechDashboardHome" component={TechDashboard} />
      <Stack.Screen name="TechRequestDetail" component={TechRequestDetail} />
    </Stack.Navigator>
  );
}

export default function TechnicianNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgCard,
          borderTopColor: COLORS.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom || 8,
          position: 'absolute',
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'TechDashboard')
            iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'TechProfile')
            iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="TechDashboard"
        component={TechDashboardStack}
        options={{ tabBarLabel: 'Requests' }}
      />
      <Tab.Screen
        name="TechProfile"
        component={TechProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}