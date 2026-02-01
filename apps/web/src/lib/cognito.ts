import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
  ISignUpResult,
} from "amazon-cognito-identity-js";

// Cognito User Pool configuration
const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
};

// Create user pool instance
export const userPool = new CognitoUserPool(poolData);

// User attributes interface
export interface UserAttributes {
  email: string;
  given_name: string;
  family_name: string;
  preferred_username: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

// Sign up a new user
export function signUp(params: SignUpParams): Promise<ISignUpResult> {
  const { email, password, firstName, lastName, username } = params;

  const attributeList: CognitoUserAttribute[] = [
    new CognitoUserAttribute({ Name: "email", Value: email }),
    new CognitoUserAttribute({ Name: "given_name", Value: firstName }),
    new CognitoUserAttribute({ Name: "family_name", Value: lastName }),
    new CognitoUserAttribute({ Name: "preferred_username", Value: username }),
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      if (result) {
        resolve(result);
      }
    });
  });
}

// Confirm sign up with verification code
export function confirmSignUp(email: string, code: string): Promise<string> {
  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

// Resend confirmation code
export function resendConfirmationCode(email: string): Promise<string> {
  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

// Sign in user
export function signIn(params: SignInParams): Promise<CognitoUserSession> {
  const { email, password } = params;

  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  const authenticationDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        resolve(session);
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

// Sign out user
export function signOut(): void {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
}

// Get current authenticated user session
export function getCurrentSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(session);
      }
    );
  });
}

// Get current user attributes
export function getCurrentUserAttributes(): Promise<UserAttributes | null> {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      cognitoUser.getUserAttributes((err, attributes) => {
        if (err) {
          reject(err);
          return;
        }

        if (!attributes) {
          resolve(null);
          return;
        }

        const userAttrs: UserAttributes = {
          email: "",
          given_name: "",
          family_name: "",
          preferred_username: "",
        };

        attributes.forEach((attr) => {
          if (attr.Name in userAttrs) {
            userAttrs[attr.Name as keyof UserAttributes] = attr.Value;
          }
        });

        resolve(userAttrs);
      });
    });
  });
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await getCurrentSession();
    return session !== null && session.isValid();
  } catch {
    return false;
  }
}
