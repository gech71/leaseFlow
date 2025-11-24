
"use client";

import { useState, useCallback, useTransition } from 'react';
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

  const execute = useCallback(
    async (input: TInput) => {
      setState(prevState => ({ ...prevState, isLoading: true, error: null }));
      
      startTransition(async () => {
        try {
          const csrfToken = Cookies.get('nibrental_csrf_token');
          
          // Here, we can't directly add headers to a server action call.
          // The framework handles it. The crucial part is that the server action
          // itself can read headers, and the middleware enforces the check.
          // However, the fetch wrapper IS necessary if we were using `fetch` to call an API route.
          // For direct server action invocation, this pattern is correct.
          // The issue is likely how the action is invoked.
          
          // Let's assume for now that the CSRF token needs to be passed if
          // we are wrapping it in a custom fetch. Since we are NOT doing that here
          // and calling the action directly, we rely on Next.js's built-in RPC.
          
          const result = await action(input);
          
          setState({ data: result, error: null, isLoading: false });
          if (options.onSuccess) {
            options.onSuccess(result);
          }
        } catch (err: any) {
          const errorMessage = err.message || "An unexpected error occurred.";
          setState({ data: null, error: errorMessage, isLoading: false });
          if (options.onError) {
            options.onError(errorMessage);
          }
        }
      });
    },
    [action, options]
  );

  return {
    execute,
    ...state,
    isLoading: state.isLoading || isPending,
  };
}
