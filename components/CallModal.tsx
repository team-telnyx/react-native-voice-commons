import React from 'react';
import { View, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Text } from '~/components/ui/text';

type CallModalProps = {
  visible: boolean;
  title: string;
  description?: string;
  isLoading?: boolean;
  loadingText?: string;
  buttons: Array<{
    text: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
  onRequestClose?: () => void;
};

export function CallModal({
  visible,
  title,
  description,
  isLoading,
  loadingText,
  buttons,
  onRequestClose,
}: CallModalProps) {
  const getButtonStyle = (variant: 'primary' | 'secondary' | 'danger' = 'primary') => {
    const baseStyle = {
      padding: 12,
      borderRadius: 8,
      flex: 1,
      marginHorizontal: 5,
    };

    switch (variant) {
      case 'danger':
        return { ...baseStyle, backgroundColor: '#dc2626' };
      case 'secondary':
        return { ...baseStyle, backgroundColor: '#2563eb' };
      case 'primary':
      default:
        return { ...baseStyle, backgroundColor: '#16a34a' };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 24,
            minWidth: 300,
            maxWidth: 400,
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: 12,
              textAlign: 'center',
              color: '#1f2937',
            }}
          >
            {title}
          </Text>

          {/* Description or Loading */}
          {isLoading ? (
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <ActivityIndicator size="large" color="#2563eb" />
              {loadingText && (
                <Text
                  style={{
                    marginTop: 12,
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: 16,
                  }}
                >
                  {loadingText}
                </Text>
              )}
            </View>
          ) : (
            description && (
              <Text
                style={{
                  marginBottom: 24,
                  textAlign: 'center',
                  fontSize: 16,
                  color: '#4b5563',
                }}
              >
                {description}
              </Text>
            )
          )}

          {/* Buttons */}
          {!isLoading && buttons.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={getButtonStyle(button.variant)}
                  onPress={button.onPress}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      color: 'white',
                      textAlign: 'center',
                      fontWeight: '600',
                      fontSize: 16,
                    }}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
