import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pingDolibarr } from '@/api/client';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useInstanceStore } from '@/stores/instanceStore';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export default function SetupScreen() {
  const { t } = useTranslation();
  const addInstance = useInstanceStore((s) => s.addInstance);
  const persistedUrl = useInstanceStore((s) => s.getActive()?.baseUrl ?? null);

  const [url, setUrl] = useState(persistedUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const validateUrl = (v: string) => {
    if (!URL_RE.test(v.trim())) {
      setError(t('setup.url_invalid'));
      return false;
    }
    setError(null);
    return true;
  };

  const onTest = async () => {
    if (!validateUrl(url)) return;
    setTesting(true);
    setTestResult(null);
    const ok = await pingDolibarr(url.trim());
    setTesting(false);
    setTestResult(ok ? 'ok' : 'fail');
  };

  const onContinue = () => {
    if (!validateUrl(url)) return;
    addInstance({ baseUrl: url.trim() });
    router.replace('/(auth)/login');
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
              InfraSScanField
            </Text>
            <Text className="mt-2 text-base text-text-muted dark:text-text-muted-dark">
              {t('setup.description')}
            </Text>
          </View>

          <TextField
            label={t('setup.url_label')}
            placeholder={t('setup.url_placeholder')}
            value={url}
            onChangeText={(v) => {
              setUrl(v);
              setTestResult(null);
              if (error) setError(null);
            }}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="url"
            inputMode="url"
            error={error}
          />

          {testResult === 'ok' ? (
            <Text className="mb-4 text-sm font-medium text-success">{t('setup.connection_ok')}</Text>
          ) : null}
          {testResult === 'fail' ? (
            <Text className="mb-4 text-sm font-medium text-danger">{t('setup.connection_failed')}</Text>
          ) : null}

          <Button
            label={t('setup.test_connection')}
            variant="secondary"
            loading={testing}
            onPress={onTest}
            className="mb-3"
          />
          <Button
            label={t('setup.continue')}
            variant="primary"
            onPress={onContinue}
            disabled={testResult === 'fail'}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
