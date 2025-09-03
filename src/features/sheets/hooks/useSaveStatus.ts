import { useState, useEffect, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * A hook that manages the state of a save indicator, including timed
 * transitions back to an idle state.
 */
export function useSaveStatus(idleTimeout: number = 2000) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'saved' || status === 'error') {
      const timer = setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, idleTimeout);

      return () => clearTimeout(timer);
    }
  }, [status, idleTimeout]);

  const onSaving = useCallback(() => setStatus('saving'), []);
  const onSuccess = useCallback(() => setStatus('saved'), []);
  const onError = useCallback((message: string) => {
    setStatus('error');
    setErrorMessage(message);
  }, []);

  return {
    status,
    errorMessage,
    onSaving,
    onSuccess,
    onError,
  };
}