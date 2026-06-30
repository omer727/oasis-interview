# Single shared API key loaded from environment variable

The programmatic REST API is secured by a single API key read from the `API_KEY` environment variable at startup. There is no key management UI, no database of keys, and no per-integration key rotation.

This was chosen because the alternative — storing multiple API keys in a database — would introduce the only persistence dependency in the system solely to support a feature the PoC does not need to demonstrate. CI/CD systems that call the endpoint configure `API_KEY` as an environment secret. Generating a new key means updating one env var and restarting the server.

## Consequences

- There is no way to revoke access for a single integration without rotating the key for all integrations. This is the main production gap; a key management table would address it.
- There is no per-caller audit trail. All programmatic requests are attributed to "the API key," not to a specific integration.
- Both limitations are intentional and documented here so a future engineer knows the decision was deliberate, not an oversight.
