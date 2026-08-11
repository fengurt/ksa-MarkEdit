const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.notes.apuch.art';

type PublicKeyOptionsJSON = Omit<
  PublicKeyCredentialCreationOptions,
  'challenge' | 'user' | 'excludeCredentials'
> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
  excludeCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>;
};

type PublicKeyRequestOptionsJSON = Omit<
  PublicKeyCredentialRequestOptions,
  'challenge' | 'allowCredentials'
> & {
  challenge: string;
  allowCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>;
};

export async function createPasskey(): Promise<void> {
  const options = await request<PublicKeyOptionsJSON>('/api/v1/passkeys/register/options', {
    method: 'POST',
  });
  const credential = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: fromBase64URL(options.challenge),
      user: { ...options.user, id: fromBase64URL(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map(item => ({
        ...item,
        id: fromBase64URL(item.id),
      })),
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Passkey creation was cancelled');
  }
  await request('/api/v1/passkeys/register/verify', {
    method: 'POST',
    body: JSON.stringify(credentialJSON(credential)),
  });
}

export async function signInWithPasskey(): Promise<void> {
  const options = await request<PublicKeyRequestOptionsJSON>(
    '/api/v1/passkeys/authenticate/options',
    { method: 'POST' },
  );
  const credential = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: fromBase64URL(options.challenge),
      allowCredentials: options.allowCredentials?.map(item => ({
        ...item,
        id: fromBase64URL(item.id),
      })),
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Passkey sign-in was cancelled');
  }
  await request('/api/v1/passkeys/authenticate/verify', {
    method: 'POST',
    body: JSON.stringify(credentialJSON(credential)),
  });
}

async function request<T = unknown>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Account service returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function credentialJSON(credential: PublicKeyCredential): unknown {
  const response = credential.response;
  const assertion = response instanceof AuthenticatorAssertionResponse ? response : undefined;
  return {
    id: credential.id,
    rawId: toBase64URL(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: response instanceof AuthenticatorAttestationResponse
      ? {
        clientDataJSON: toBase64URL(response.clientDataJSON),
        attestationObject: toBase64URL(response.attestationObject),
        transports: response.getTransports(),
      }
      : {
        clientDataJSON: toBase64URL(response.clientDataJSON),
        authenticatorData: assertion ? toBase64URL(assertion.authenticatorData) : '',
        signature: assertion ? toBase64URL(assertion.signature) : '',
        userHandle: assertion?.userHandle ? toBase64URL(assertion.userHandle) : null,
      },
  };
}

function fromBase64URL(value: string): ArrayBuffer {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  );
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0)).buffer;
}

function toBase64URL(value: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(value));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
