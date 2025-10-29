import { Stack } from 'expo-router';
import * as React from 'react';
import { View, Text } from 'react-native';
import { TelnyxLoginForm } from '~/components/TelnyxLoginForm';

export default function Screen() {
  return (
    <View
      className="flex-1 justify-center items-center gap-5 p-6 bg-secondary/30"
      style={{ backgroundColor: '#f0f0f0', flex: 1 }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <TelnyxLoginForm debug={true} />
    </View>
  );
}
