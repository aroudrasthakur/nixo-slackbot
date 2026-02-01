"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  getCurrentSession,
  getCurrentUserAttributes,
  UserAttributes,
  SignUpParams,
  SignInParams,
} from "@/lib/cognito";

interface AuthContextType {
  user: UserAttributes | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (params: SignInParams) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAttributes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const session = await getCurrentSession();
      if (session && session.isValid()) {
        const attributes = await getCurrentUserAttributes();
        setUser(attributes);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };
    initAuth();
  }, [refreshUser]);

  const signIn = async (params: SignInParams) => {
    try {
      await cognitoSignIn(params);
      await refreshUser();
      router.push("/dashboard");
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (params: SignUpParams) => {
    try {
      await cognitoSignUp(params);
      // Redirect to verify page with email
      router.push(`/verify?email=${encodeURIComponent(params.email)}`);
    } catch (error) {
      throw error;
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      await cognitoConfirmSignUp(email, code);
      router.push(`/signin?email=${encodeURIComponent(email)}`);
    } catch (error) {
      throw error;
    }
  };

  const signOut = () => {
    cognitoSignOut();
    setUser(null);
    router.push("/");
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
