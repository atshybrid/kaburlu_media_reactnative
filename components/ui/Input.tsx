import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { BorderRadius } from '@/constants/BorderRadius';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
  containerStyle?: any;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  required = false,
  leftIcon,
  rightIcon,
  helperText,
  containerStyle,
  style,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        
        <TextInput
          {...textInputProps}
          style={[styles.input, style]}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          accessibilityLabel={label || textInputProps.accessibilityLabel}
          accessibilityState={{ disabled: textInputProps.editable === false }}
        />
        
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        {error && (
          <View style={styles.errorIcon}>
            <MaterialIcons name="error-outline" size={20} color="#EF4444" />
          </View>
        )}
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {helperText && !error && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  
  label: {
    fontSize: Typography.bodySmall,
    fontWeight: '500',
    color: '#374151',
    marginBottom: Spacing.xs,
  },
  
  required: {
    color: '#EF4444',
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: BorderRadius.md,
    backgroundColor: '#fff',
    minHeight: 44,
    paddingHorizontal: Spacing.md,
  },
  
  inputContainerFocused: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  
  inputContainerError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  
  input: {
    flex: 1,
    fontSize: Typography.body,
    color: '#111827',
    paddingVertical: Spacing.sm + 2,
  },
  
  leftIcon: {
    marginRight: Spacing.sm,
  },
  
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  
  errorIcon: {
    marginLeft: Spacing.sm,
  },
  
  errorContainer: {
    marginTop: Spacing.xs,
  },
  
  errorText: {
    fontSize: Typography.caption,
    color: '#EF4444',
  },
  
  helperText: {
    fontSize: Typography.caption,
    color: '#6B7280',
    marginTop: Spacing.xs,
  },
});

export default Input;
