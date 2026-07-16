import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Copy } from '@/constants/copy';
import { useUpdateProfile } from '@/features/account/hooks/useUpdateProfile';
import { useUserProfileQuery } from '@/features/account/hooks/useUserProfileQuery';
import { UpdateProfileSchema } from '@/features/account/schemas';
import type { UpdateProfileInput } from '@/features/account/schemas';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { mapError } from '@/lib/mapError';

export default function AccountScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading } = useUserProfileQuery();
  const updateProfile = useUpdateProfile();
  const signOut = useSignOut();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: { displayName: '' },
  });

  useEffect(() => {
    if (profile) {
      reset({ displayName: profile.displayName });
    }
  }, [profile, reset]);

  function onSave(data: UpdateProfileInput) {
    updateProfile.mutate(data);
  }

  const saveError = updateProfile.error ? mapError(updateProfile.error) : null;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0F0F0F]">
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-[#0F0F0F] px-6"
      style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
    >
      <Text className="mb-8 text-2xl font-bold text-[#F9F9F9]">{Copy.account.title}</Text>

      <View className="mb-4">
        <Text className="mb-2 text-sm font-medium text-neutral-400">{Copy.account.emailLabel}</Text>
        <View className="rounded-xl bg-[#1A1A1A] px-4 py-3">
          <Text className="text-sm text-neutral-500">{profile?.email ?? '—'}</Text>
        </View>
      </View>

      <View className="mb-6">
        <Text className="mb-2 text-sm font-medium text-neutral-400">
          {Copy.account.displayNameLabel}
        </Text>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholderTextColor="#525252"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="words"
              returnKeyType="done"
            />
          )}
        />
        {errors.displayName !== undefined && (
          <Text className="mt-1 text-xs text-red-400">{errors.displayName.message}</Text>
        )}
      </View>

      {saveError !== null && (
        <View className="mb-4 rounded-xl bg-red-500/20 px-4 py-3">
          <Text className="text-sm text-red-400">{saveError.message}</Text>
        </View>
      )}

      {updateProfile.isSuccess && (
        <View className="mb-4 rounded-xl bg-green-500/20 px-4 py-3">
          <Text className="text-sm text-green-400">{Copy.account.profileUpdated}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleSubmit(onSave)}
        disabled={!isDirty || updateProfile.isPending}
        className={`mb-4 rounded-xl px-4 py-4 ${
          isDirty && !updateProfile.isPending ? 'bg-indigo-600' : 'bg-[#2A2A2A]'
        }`}
        accessibilityRole="button"
      >
        {updateProfile.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            className={`text-center text-sm font-semibold ${
              isDirty ? 'text-white' : 'text-neutral-500'
            }`}
          >
            {Copy.account.saveButton}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => signOut.mutate()}
        disabled={signOut.isPending}
        className="mt-auto rounded-xl border border-red-500/40 px-4 py-4"
        accessibilityRole="button"
      >
        <Text className="text-center text-sm font-semibold text-red-400">{Copy.auth.signOut}</Text>
      </TouchableOpacity>
    </View>
  );
}
