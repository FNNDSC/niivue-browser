# niivue-browser

A simple [NiiVue](https://github.com/niivue/niivue) application for browsing surface meshes found in a filesystem directory.

## Development

1. Create a directory (or symlink) `./data` which contains subdirectories, where each subdirectory contains
   data for a single subject. Optionally, place a file called `./data/*.csv` which provides metadata about subjects.
2. Run `pnpm run dev` and `pnpm run dev:proxy` at the same time.
3. In your browser, open up `http://localhost:51733/`
