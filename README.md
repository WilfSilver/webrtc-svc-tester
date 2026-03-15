# webrtc-svc-tester

This code is a work in progress building towards creating a basic E2EE video calling application with support of SVC and Simulcast. This will then be used to test the benefits and downsides of either solution.

Code was originally taken from the [mediasoup's example directories](https://github.com/versatica/mediasoup/tree/v3/rust/examples).

## Supported Browsers

This only works on chromium based browsers > 86 due to the use of `RTCRtpSender.createEncodedStreams`, see [mozilla's RTCRtpSender documentation](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender).

## Setup

To install dependencies:

```bash
bun install
```

Other dependencies: `uv`, `cargo`, `libstdc++-static` (for the server)

## Running

```sh
bun dev:server # Run the SFU server
bun dev:client # Run the client
```

## Development

For the code frontend, I am using biome, with the backend using 

```sh
bun fmt # Format both frontend and backend
bun dev:client # Run the client
```
