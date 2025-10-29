import * as React from 'react';
import { TextInput, type TextInputProps, View, TouchableOpacity } from 'react-native';
import { cn } from '~/lib/theme/utils';
import { Eye, EyeOff } from 'lucide-react-native';
import { iconWithClassName } from '~/lib/icons/iconWithClassName';

// Setup icons for className support
iconWithClassName(Eye);
iconWithClassName(EyeOff);

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  ref?: React.RefObject<TextInput>;
}

function PasswordInput({ className, placeholderClassName, ...props }: PasswordInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const textInputRef = React.useRef<TextInput>(null);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
    // Keep focus on the input after toggling
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  };

  const handleFocus = (event: any) => {
    // Call the original onFocus if provided
    props.onFocus?.(event);
    // Select all text when focusing (after a small delay to ensure it works)
    setTimeout(() => {
      if (props.value && props.value.length > 0) {
        textInputRef.current?.setSelection(0, props.value.length);
      }
    }, 100);
  };

  const handleTextChange = (text: string) => {
    // Remove any newlines or multiple spaces that might cause multi-line display
    const cleanedText = text.replace(/\n|\r/g, '').replace(/\s+/g, ' ');
    props.onChangeText?.(cleanedText);
  };

  return (
    <View className="relative">
      <TextInput
        ref={textInputRef}
        className={cn(
          'web:flex h-10 native:h-12 web:w-full rounded-md border border-input bg-background px-3 web:py-2 text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground placeholder:text-muted-foreground web:ring-offset-background file:border-0 file:bg-transparent file:font-medium web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          'pr-10', // Add right padding for the icon
          props.editable === false && 'opacity-50 web:cursor-not-allowed',
          className
        )}
        placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
        secureTextEntry={!isPasswordVisible}
        multiline={false}
        numberOfLines={1}
        scrollEnabled={false} // Disable scrolling to prevent multi-line appearance
        textAlignVertical="center"
        textBreakStrategy="simple" // Prevent text wrapping
        blurOnSubmit={true}
        selectTextOnFocus={true} // Select all text on focus
        onChangeText={handleTextChange}
        style={[
          {
            textAlign: 'left',
            writingDirection: 'ltr',
            height: 48, // Fixed height
            lineHeight: 20, // Control line height
            maxHeight: 48, // Enforce max height
          },
          props.style,
        ]}
        {...props}
        onFocus={handleFocus}
      />
      <TouchableOpacity
        onPress={togglePasswordVisibility}
        className="absolute right-2 top-0 bottom-0 justify-center items-center w-8 h-full"
        style={{ justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={0.6}
        accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
        accessibilityRole="button"
        accessibilityHint="Toggles password visibility"
      >
        {isPasswordVisible ? (
          <EyeOff size={20} className="text-muted-foreground" />
        ) : (
          <Eye size={20} className="text-muted-foreground" />
        )}
      </TouchableOpacity>
    </View>
  );
}

export { PasswordInput };
