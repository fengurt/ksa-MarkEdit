# ksamint read-only Agent SDK

`@ksamint/agent-sdk` downloads an encrypted capability catalog, validates the
device-signed manifest, unwraps a read-only capability with HPKE
P-256/SHA-256/AES-256-GCM, and decrypts Markdown only in the Agent process.
The ksamint service never receives plaintext, paths, searches, or Vault keys.

The first protocol version supports explicit whole-Vault read-only grants.
Filtered path/tag grants are rejected until per-file key envelopes are present;
the SDK never pretends that a client-side filter is a cryptographic boundary.

Install the self-contained release tarball (no repository-relative packages are
required):

```sh
npm install ./ksamint-agent-sdk-2.0.0.tgz
```

First generate a dedicated Agent identity and protect the private key like an
API credential:

```ts
import { generateAgentIdentity } from '@ksamint/agent-sdk';

const identity = await generateAgentIdentity();
console.log(identity.publicKeyHex);
// Store identity.privateKeyHex in the Agent's secret store.
```

Use the printed public key with the independent recovery CLI. The output is
mode `0600`, expires after 24 hours by default, and contains the bearer token
and opaque grant that the account service registers:

```sh
ksamint-vault create-agent-grant \
  --kit /secure/offline/location/ksamint-recovery.json \
  --agent-public-key "$KSAMINT_HPKE_PUBLIC_KEY" \
  --output /secure/agent/ksamint-agent-grant.json
```

After the grant package has been registered with the account service, connect
using its `grantId`, `accessToken`, and the matching private key:

```ts
import { KsamintAgentClient } from '@ksamint/agent-sdk';

const client = await KsamintAgentClient.connect({
  apiBase: 'https://api.notes.apuch.art',
  grantId: process.env.KSAMINT_GRANT_ID!,
  accessToken: process.env.KSAMINT_ACCESS_TOKEN!,
  recipientPrivateKey: process.env.KSAMINT_HPKE_PRIVATE_KEY!,
});

console.log(client.search('research'));
client.close();
```

The SDK zeroes its in-memory Vault key on `close()`. Capability registration
and revocation are intentionally account-owner operations and are not exposed
through this read-only package.
