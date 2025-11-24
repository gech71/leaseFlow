
"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from 'react';
import Cookies from 'js-cookie';

interface ActionState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface UseServerActionOptions<T> {
  initialData?: T | null;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export function useServerAction<TInput, TOutput>(
  action: (input: TInput) => Promise<TOutput>,
  options: UseServerActionOptions<TOutput> = {}
) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState<TOutput>>({
    data: options.initialData || null,
    error: null,
    isLoading: false,
  });

  // By using refs, we ensure that the functions passed in `options` don't
  // need to be memoized by the calling component.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);


  const execute = useCallback(
    (input: TInput) => {
      setState(prevState => ({ ...prevState, isLoading: true, error: null }));
      
      startTransition(async () => {
        try {
          const result = await action(input);
          
          setState({ data: result, error: null, isLoading: false });
          if (optionsRef.current.onSuccess) {
            optionsRef.current.onSuccess(result);
          }
        } catch (err: any) {
          const errorMessage = err.message || "An unexpected error occurred.";
          setState({ data: null, error: errorMessage, isLoading: false });
          if (optionsRef.current.onError) {
            optionsRef.current.onError(errorMessage);
          }
        }
      });
    },
    [action] // The dependency array is now stable
  );

  return {
    execute,
    ...state,
    isLoading: state.isLoading || isPending,
  };
}
