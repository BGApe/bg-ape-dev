import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { firebaseAuthProvider } from '@/features/auth/api/FirebaseAuthProvider';
import { useSignIn } from '@/features/auth/hooks/useSignIn';
import { SignInSchema, SignUpSchema } from '@/features/auth/schemas';
import type { SignInInput, SignUpInput } from '@/features/auth/schemas';
import { mapError } from '@/lib/mapError';

export default function LoginScreen(): React.JSX.Element {
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpPending, setSignUpPending] = useState(false);

  const signIn = useSignIn();

  const signInForm = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  function onSignIn(data: SignInInput) {
    signIn.mutate({ email: data.email, password: data.password });
  }

  async function onSignUp(data: SignUpInput) {
    setSignUpError(null);
    setSignUpPending(true);
    try {
      await firebaseAuthProvider.signUp(data.email, data.password, data.displayName);
    } catch (err) {
      setSignUpError(mapError(err).message);
    } finally {
      setSignUpPending(false);
    }
  }

  const signInError = signIn.error ? mapError(signIn.error).message : null;

  return (
    <View className="flex-1 items-center justify-center bg-[#0F0F0F] px-6">
      <Text className="mb-2 text-3xl font-bold tracking-tight text-[#F9F9F9]">{Copy.app.name}</Text>
      <Text className="mb-10 text-sm text-neutral-400">
        {mode === 'sign_in' ? Copy.auth.signIn : Copy.auth.signUp}
      </Text>

      {mode === 'sign_in' ? (
        <View className="w-full">
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-neutral-400">
              {Copy.auth.emailLabel}
            </Text>
            <Controller
              control={signInForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
                  placeholder="you@example.com"
                  placeholderTextColor="#525252"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              )}
            />
            {signInForm.formState.errors.email !== undefined && (
              <Text className="mt-1 text-xs text-red-400">
                {signInForm.formState.errors.email.message}
              </Text>
            )}
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-neutral-400">
              {Copy.auth.passwordLabel}
            </Text>
            <Controller
              control={signInForm.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
                  placeholder="••••••••"
                  placeholderTextColor="#525252"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={signInForm.handleSubmit(onSignIn)}
                />
              )}
            />
            {signInForm.formState.errors.password !== undefined && (
              <Text className="mt-1 text-xs text-red-400">
                {signInForm.formState.errors.password.message}
              </Text>
            )}
          </View>

          {signInError !== null && (
            <View className="mb-4 rounded-xl bg-red-500/20 px-4 py-3">
              <Text className="text-sm text-red-400">{signInError}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={signInForm.handleSubmit(onSignIn)}
            disabled={signIn.isPending}
            className="mb-4 rounded-xl bg-indigo-600 px-4 py-4"
            accessibilityRole="button"
          >
            {signIn.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-center text-sm font-semibold text-white">
                {Copy.auth.signIn}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('sign_up')} accessibilityRole="button">
            <Text className="text-center text-sm text-neutral-400">
              {Copy.auth.noAccount}{' '}
              <Text className="font-semibold text-indigo-400">{Copy.auth.signUp}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="w-full">
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-neutral-400">
              {Copy.account.displayNameLabel}
            </Text>
            <Controller
              control={signUpForm.control}
              name="displayName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
                  placeholder="Your name"
                  placeholderTextColor="#525252"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              )}
            />
            {signUpForm.formState.errors.displayName !== undefined && (
              <Text className="mt-1 text-xs text-red-400">
                {signUpForm.formState.errors.displayName.message}
              </Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-neutral-400">
              {Copy.auth.emailLabel}
            </Text>
            <Controller
              control={signUpForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
                  placeholder="you@example.com"
                  placeholderTextColor="#525252"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              )}
            />
            {signUpForm.formState.errors.email !== undefined && (
              <Text className="mt-1 text-xs text-red-400">
                {signUpForm.formState.errors.email.message}
              </Text>
            )}
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-neutral-400">
              {Copy.auth.passwordLabel}
            </Text>
            <Controller
              control={signUpForm.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
                  placeholder="••••••••"
                  placeholderTextColor="#525252"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={signUpForm.handleSubmit(onSignUp)}
                />
              )}
            />
            {signUpForm.formState.errors.password !== undefined && (
              <Text className="mt-1 text-xs text-red-400">
                {signUpForm.formState.errors.password.message}
              </Text>
            )}
          </View>

          {signUpError !== null && (
            <View className="mb-4 rounded-xl bg-red-500/20 px-4 py-3">
              <Text className="text-sm text-red-400">{signUpError}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={signUpForm.handleSubmit(onSignUp)}
            disabled={signUpPending}
            className="mb-4 rounded-xl bg-indigo-600 px-4 py-4"
            accessibilityRole="button"
          >
            {signUpPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-center text-sm font-semibold text-white">
                {Copy.auth.signUp}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('sign_in')} accessibilityRole="button">
            <Text className="text-center text-sm text-neutral-400">
              {Copy.auth.alreadyHaveAccount}{' '}
              <Text className="font-semibold text-indigo-400">{Copy.auth.signIn}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
