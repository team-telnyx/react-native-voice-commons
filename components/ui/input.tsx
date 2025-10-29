import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '~/lib/theme/utils';

function Input({
  className,
  placeholderClassName,
  multiline = false,
  numberOfLines = 1,
  ...props
}: TextInputProps & {
  ref?: React.RefObject<TextInput>;
}) {
  const handleTextChange = React.useCallback(
    (text: string) => {
      if (!multiline && props.onChangeText) {
        // For single line inputs, remove newlines and clean up text
        const cleanedText = text.replace(/\n|\r/g, '').replace(/\s+/g, ' ');
        props.onChangeText(cleanedText);
      } else if (props.onChangeText) {
        props.onChangeText(text);
      }
    },
    [multiline, props.onChangeText]
  );

  return (
    <TextInput
      className={cn(
        'web:flex h-10 native:h-12 web:w-full rounded-md border border-input bg-background px-3 web:py-2 text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground placeholder:text-muted-foreground web:ring-offset-background file:border-0 file:bg-transparent file:font-medium web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
        props.editable === false && 'opacity-50 web:cursor-not-allowed',
        className
      )}
      placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? 'top' : 'center'}
      scrollEnabled={multiline}
      selectTextOnFocus={!multiline}
      blurOnSubmit={true}
      textBreakStrategy={multiline ? 'balanced' : 'simple'}
      {...props}
      onChangeText={handleTextChange}
    />
  );
}

export { Input };
