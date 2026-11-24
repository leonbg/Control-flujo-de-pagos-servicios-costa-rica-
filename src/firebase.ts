import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';

interface FirebaseAppletConfig {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

// Optional local config load so external GitHub clones without firebase-applet-config.json still build cleanly
const localConfigModules = import.meta.glob<
  { default?: FirebaseAppletConfig } & FirebaseAppletConfig
>('../firebase-applet-config.json', { eager: true });

const localModule = localConfigModules['../firebase-applet-config.json'];
const localConfig: FirebaseAppletConfig =
  localModule?.default ?? localModule ?? {};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey || '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain || '',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId || '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    localConfig.storageBucket ||
    '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    localConfig.messagingSenderId ||
    '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId || '',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
    localConfig.measurementId ||
    '',
};

const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  localConfig.firestoreDatabaseId ||
  '(default)';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
