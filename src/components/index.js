// src/components/index.js

import React from 'react';
import {
  TouchableOpacity, Text, View, TextInput, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';

// ============================================================
// Button
// ============================================================
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, textStyle }) {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  const isAccent = variant === 'accent';

  const bgColor = isPrimary ? COLORS.primary : isDanger ? COLORS.danger : isAccent ? COLORS.accent : 'transparent';
  const txtColor = isOutline ? COLORS.primary : '#FFFFFF';
  const borderColor = isOutline ? COLORS.primary : isDanger ? COLORS.danger : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.7}
      style={[
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          backgroundColor: bgColor, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
          borderWidth: isOutline ? 1.5 : 0, borderColor,
          opacity: (loading || disabled) ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={txtColor} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={txtColor} style={{ marginRight: 8 }} />}
          <Text style={[{ color: txtColor, fontSize: 16, fontWeight: '600' }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Card
// ============================================================
export function Card({ children, style, onPress }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          backgroundColor: COLORS.bgWhite, borderRadius: 14, padding: 16,
          marginBottom: 12, ...SHADOWS.sm,
        },
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
}

// ============================================================
// Header
// ============================================================
export function Header({ title, onBack, rightIcon, onRightPress, subtitle }) {
  return (
    <View style={{
      backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 16,
      paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{title}</Text>
        {subtitle && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {rightIcon && (
        <TouchableOpacity onPress={onRightPress} style={{ padding: 4 }}>
          <Ionicons name={rightIcon} size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================
// FormInput
// ============================================================
export function FormInput({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry, icon, error }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 }}>{label}</Text>}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1,
        borderColor: error ? COLORS.danger : COLORS.border, paddingHorizontal: 12,
      }}>
        {icon && <Ionicons name={icon} size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          style={{
            flex: 1, fontSize: 15, color: COLORS.text,
            paddingVertical: multiline ? 12 : 14,
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
      </View>
      {error && <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

// ============================================================
// Badge
// ============================================================
export function Badge({ label, color, bg, icon, style }) {
  return (
    <View style={[
      {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: bg || '#F3F4F6', borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 4,
      },
      style,
    ]}>
      {icon && <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} />}
      <Text style={{ fontSize: 12, fontWeight: '600', color: color || COLORS.textSecondary }}>{label}</Text>
    </View>
  );
}

// ============================================================
// EmptyState
// ============================================================
export function EmptyState({ icon, title, subtitle, actionTitle, onAction }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
      <Ionicons name={icon || 'file-tray-outline'} size={56} color={COLORS.textLight} />
      <Text style={{ fontSize: 17, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12 }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 14, color: COLORS.textLight, marginTop: 6, textAlign: 'center' }}>{subtitle}</Text>}
      {actionTitle && onAction && (
        <Button title={actionTitle} onPress={onAction} icon="add-circle-outline" style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

// ============================================================
// ProgressBar
// ============================================================
export function ProgressBar({ progress = 0, height = 8, color, style }) {
  const barColor = color || (progress >= 80 ? COLORS.success : progress >= 40 ? COLORS.accent : COLORS.info);
  return (
    <View style={[{ height, backgroundColor: '#E5E7EB', borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <View style={{
        width: `${Math.min(progress, 100)}%`, height: '100%',
        backgroundColor: barColor, borderRadius: height / 2,
      }} />
    </View>
  );
}
