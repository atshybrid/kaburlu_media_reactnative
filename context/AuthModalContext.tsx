/**
 * AuthModalContext
 * 
 * Global context for showing/hiding the login bottom sheet from anywhere in the app.
 * This allows triggering the login flow without navigating to a separate screen,
 * keeping the user on their current content.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';

interface AuthModalContextType {
  /** Whether the login sheet is currently visible */
  showLoginSheet: boolean;
  /** Open the login bottom sheet */
  openLoginSheet: (options?: LoginSheetOptions) => void;
  /** Close the login bottom sheet */
  closeLoginSheet: () => void;
  /** Options passed when opening */
  sheetOptions: LoginSheetOptions | null;
  /** Callback to run after successful login */
  onLoginSuccess: ((data: any) => void) | null;
  /** Set the success callback */
  setOnLoginSuccess: (callback: ((data: any) => void) | null) => void;
}

interface LoginSheetOptions {
  /** Prefill mobile number */
  mobile?: string;
  /** Source/context of where login was triggered from */
  from?: 'post' | 'comment' | 'profile' | 'chat' | 'general';
  /** Custom title override */
  title?: string;
  /** Custom subtitle override */
  subtitle?: string;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export const AuthModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [sheetOptions, setSheetOptions] = useState<LoginSheetOptions | null>(null);
  const [onLoginSuccess, setOnLoginSuccessState] = useState<((data: any) => void) | null>(null);

  const openLoginSheet = useCallback((options?: LoginSheetOptions) => {
    setSheetOptions(options || null);
    setShowLoginSheet(true);
  }, []);

  const closeLoginSheet = useCallback(() => {
    setShowLoginSheet(false);
    // Clear options and callback after a delay to allow close animation
    setTimeout(() => {
      setSheetOptions(null);
      setOnLoginSuccessState(null);
    }, 350);
  }, []);

  const setOnLoginSuccess = useCallback((callback: ((data: any) => void) | null) => {
    setOnLoginSuccessState(() => callback);
  }, []);

  return (
    <AuthModalContext.Provider
      value={{
        showLoginSheet,
        openLoginSheet,
        closeLoginSheet,
        sheetOptions,
        onLoginSuccess,
        setOnLoginSuccess,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
};

export type { LoginSheetOptions };
