import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login as loginApi } from '@/api/endpoints/auth';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/authStore';
import { useInstanceStore } from '@/stores/instanceStore';
import type { ApiError } from '@/api/client';
import { logger } from '@/utils/logger';
import { secureStorage } from '@/utils/secureStorage';

export default function LoginScreen() {
  const { t } = useTranslation();
  const baseUrl = useInstanceStore((s) => s.getActive()?.baseUrl ?? null);
  const lastUserLogin = useInstanceStore((s) => s.getActive()?.lastUserLogin ?? '');
  const setSession = useAuthStore((s) => s.setSession);

  const [username, setUsername] = useState(lastUserLogin);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!username || !password) {
      setErrorMsg(t('login.bad_credentials'));
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      // device_uuid : stable per-install identifier, persisted in secure-store at first boot.
      const deviceUuid = await secureStorage.getDeviceUuid();
      const res = await loginApi({
        login: username.trim(),
        password,
        device_uuid: deviceUuid,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        app_version: '1.0.0',
      });
      await setSession({
        token: res.token,
        expiresAt: res.expires_at,
        user: res.user,
        permissions: res.permissions,
        settings: res.settings,
        license: res.license,
      });
      router.replace('/(tabs)');
    } catch (e) {
      const apiErr = e as Partial<ApiError>;
      logger.warn('login failed', apiErr);
      if (apiErr.status === 401) {
        setErrorMsg(t('login.bad_credentials'));
      } else if (apiErr.status === 403) {
        setErrorMsg(t('login.forbidden'));
      } else {
        setErrorMsg(apiErr.message ?? t('common.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10">
            <Text className="text-3xl font-bold text-text dark:text-text-dark">
              {t('login.title')}
            </Text>
            <Text className="mt-2 text-base text-text-muted dark:text-text-muted-dark">
              {t('login.description')}
            </Text>
            {baseUrl ? (
              <Text className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
                {baseUrl}
              </Text>
            ) : null}
          </View>

          <TextField
            label={t('login.login_label')}
            placeholder={t('login.login_placeholder')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
          />

          <TextField
            label={t('login.password_label')}
            placeholder={t('login.password_placeholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
          />

          {errorMsg ? (
            <Text className="mb-4 text-sm font-medium text-danger">{errorMsg}</Text>
          ) : null}

          <Button
            label={t('login.submit')}
            variant="primary"
            onPress={onSubmit}
            loading={submitting}
            disabled={!baseUrl}
          />

          <Pressable
            className="mt-6 self-center px-2 py-2"
            onPress={() => router.replace('/(auth)/setup')}
          >
            <Text className="text-sm text-text-muted dark:text-text-muted-dark">
              {t('common.back')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
