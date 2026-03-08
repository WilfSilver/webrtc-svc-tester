# video-caller

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
