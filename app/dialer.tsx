import React from 'react';
import { View } from 'react-native';
import { TelnyxDialer } from '~/components/TelnyxDialer';

const dialer = () => {
  return (
    <View style={{ flex: 1 }}>
      <TelnyxDialer debug={true} />
    </View>
  );
};

export default dialer;
