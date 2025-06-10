# slippi-rpc
Allows players of Slippi to run a console window that tells others what they're doing on Slippi netplay.

# Build Manually

You will have to install [NodeJS](https://nodejs.org/en).

Then, run the following in the directory you install source to:

```
npm install @slippi/slippi-js
npm install discord-rpc
```

To run `rpc.js`, just type `node rpc` in your console to run the script.

If you wish to compile into an executable, do the following as separate commands:

```
npm install -g pkg
pkg . --targets node18-win-x64 --output slippi-rpc.exe
```

`win-x64` can be replaced with `linux-x64` for Linux-based OSes...
`macos-x64` for x64 based MacOS machines...
`macos-arm64` for ARM-based MacOS machines...

and `node18` can be replaced with whichever node version you want, as long as it supports the script.


