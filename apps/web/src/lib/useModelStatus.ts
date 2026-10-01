import { useEffect, useState } from 'react';
import { getRecognizer } from '../vision/workerRecognizer';

export type ModelStatus = 'loading' | 'ready' | 'error';

/** Prepara il modello appena si apre la smazzata, mentre si scattano le foto. */
export function useModelStatus(): ModelStatus {
  const [status, setStatus] = useState<ModelStatus>('loading');
  useEffect(() => {
    let cancelled = false;
    getRecognizer()
      .warmUp()
      .then(
        () => !cancelled && setStatus('ready'),
        () => !cancelled && setStatus('error'),
      );
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}
