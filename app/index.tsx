import { Stack } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { demoColors } from '~/components/demoTheme';
import { TelnyxLoginForm } from '~/components/TelnyxLoginForm';

export default function Screen() {
  return (
    <View style={{ backgroundColor: demoColors.background, flex: 1 }}>
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
