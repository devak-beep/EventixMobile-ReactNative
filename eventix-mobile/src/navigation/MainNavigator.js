import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, Image } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

import EventListScreen from '../screens/events/EventListScreen';
import EventDetailScreen from '../screens/events/EventDetailScreen';
import LockSeatsScreen from '../screens/booking/LockSeatsScreen';
import ConfirmBookingScreen from '../screens/booking/ConfirmBookingScreen';
import PaymentScreen from '../screens/booking/PaymentScreen';
import BookingSuccessScreen from '../screens/booking/BookingSuccessScreen';
import MyBookingsScreen from '../screens/booking/MyBookingsScreen';
import CreateEventScreen from '../screens/events/CreateEventScreen';
import RequestEventScreen from '../screens/events/RequestEventScreen';
import EventRequestsScreen from '../screens/events/EventRequestsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Professional SVG-style tab icons using text
function TabIcon({ name, focused, color }) {
  const icons = {
    Events:    focused ? '▣' : '▢',
    Bookings:  focused ? '◉' : '◎',
    Manage:    focused ? '⊞' : '⊟',
    Settings:  focused ? '◈' : '◇',
  };
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, { color }]}>{icons[name]}</Text>
    </View>
  );
}

function EventsStack({ theme }) {
  const HeaderLogo = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={require('../../assets/eventix-logo.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
      <Text style={{ color: theme.primary, fontSize: font.xl, fontWeight: '800', letterSpacing: 0.5 }}>Eventix</Text>
    </View>
  );
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.header }, headerTintColor: theme.headerText, headerTitleStyle: { fontWeight: '700', fontSize: font.lg }, contentStyle: { backgroundColor: theme.bg } }}>
      <Stack.Screen name="EventList" component={EventListScreen} options={{ headerTitle: () => <HeaderLogo /> }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
      <Stack.Screen name="LockSeats" component={LockSeatsScreen} options={{ title: 'Select Seats' }} />
      <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} options={{ title: 'Confirm Booking' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ title: 'Booking Confirmed', headerLeft: () => null }} />
    </Stack.Navigator>
  );
}

function BookingsStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.header }, headerTintColor: theme.headerText, headerTitleStyle: { fontWeight: '700', fontSize: font.lg }, contentStyle: { backgroundColor: theme.bg } }}>
      <Stack.Screen name="MyBookings" component={MyBookingsScreen} options={{ title: 'My Bookings' }} />
    </Stack.Navigator>
  );
}

function ManageStack({ theme, user }) {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.header }, headerTintColor: theme.headerText, headerTitleStyle: { fontWeight: '700', fontSize: font.lg }, contentStyle: { backgroundColor: theme.bg } }}>
      {user?.role === 'user' ? (
        <>
          <Stack.Screen name="RequestEvent" component={RequestEventScreen} options={{ title: 'Request Event' }} />
          <Stack.Screen name="MyRequests" component={EventRequestsScreen} options={{ title: 'My Requests' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Create Event' }} />
          <Stack.Screen name="EventRequests" component={EventRequestsScreen} options={{ title: 'Event Requests' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

function SettingsStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.header }, headerTintColor: theme.headerText, headerTitleStyle: { fontWeight: '700', fontSize: font.lg }, contentStyle: { backgroundColor: theme.bg } }}>
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

export default function MainNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const screenOpts = { headerStyle: { backgroundColor: theme.header }, headerTintColor: theme.headerText, headerTitleStyle: { fontWeight: '700', fontSize: font.lg }, contentStyle: { backgroundColor: theme.bg } };

  const EventsTabScreen = useCallback(() => <EventsStack theme={theme} />, [theme]);
  const BookingsTabScreen = useCallback(() => <BookingsStack theme={theme} />, [theme]);
  const ManageTabScreen = useCallback(() => <ManageStack theme={theme} user={user} />, [theme, user]);
  const SettingsTabScreen = useCallback(() => <SettingsStack theme={theme} />, [theme]);

  const tabOpts = (name) => ({
    tabBarLabel: name,
    tabBarIcon: ({ focused, color }) => <TabIcon name={name} focused={focused} color={color} />,
    headerShown: false,
  });

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: theme.border, height: 60, paddingBottom: spacing.sm },
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: '600', marginTop: -2 },
      }}
    >
      <Tab.Screen name="EventsTab" component={EventsTabScreen} options={tabOpts('Events')} />
      <Tab.Screen name="BookingsTab" component={BookingsTabScreen} options={tabOpts('Bookings')} />
      <Tab.Screen name="ManageTab" component={ManageTabScreen} options={tabOpts('Manage')} />
      <Tab.Screen name="SettingsTab" component={SettingsTabScreen} options={tabOpts('Settings')} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
});
