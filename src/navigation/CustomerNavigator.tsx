import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import CustomerDashboard from '../screens/customer/DashboardScreen';
import VehiclesScreen from '../screens/customer/VehiclesScreen';
import AddVehicleScreen from '../screens/customer/AddVehicleScreen';
import RequestsScreen from '../screens/customer/RequestsScreen';
import CreateRequestScreen from '../screens/customer/CreateRequestScreen';
import RequestDetailScreen from '../screens/customer/RequestDetailScreen';
import MapScreen from '../screens/customer/MapScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import NotificationsScreen from '../screens/customer/NotificationsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Stack wrapping each tab section ────────────────────────
function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerHome" component={CustomerDashboard} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

function VehiclesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VehiclesList" component={VehiclesScreen} />
      <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
    </Stack.Navigator>
  );
}

function RequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RequestsList" component={RequestsScreen} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
    </Stack.Navigator>
  );
}

// ─── Tab Navigator ────────────────────────────────────────
export default function CustomerNavigator() {
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
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Vehicles')
            iconName = focused ? 'car-sport' : 'car-sport-outline';
          else if (route.name === 'Requests')
            iconName = focused ? 'construct' : 'construct-outline';
          else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Vehicles" component={VehiclesStack} />
      <Tab.Screen name="Requests" component={RequestsStack} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}