# Weight Tracker

The original browser app is a static PWA (`index.html`, `style.css`, and `chart.js`). The Expo Android app lives in [`native-app`](./native-app/README.md) and keeps its native data separate from browser storage.

## Move web data to Android

1. In the web app, open the profile menu and choose **Export for native app**.
2. Save the downloaded JSON file on the phone.
3. In the native app, open the profile menu, choose **Import web app data**, and select that file. Import replaces the native app's current profiles and records.

## Build an Android APK with EAS

From `native-app`, sign in to Expo and link/configure this project once:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Then start the internal preview build:

```powershell
npx eas-cli@latest build -p android --profile preview
```

The `preview` profile in `native-app/eas.json` requests an installable APK. When the cloud build finishes, open its EAS build page on your phone and download the APK.

For local development, run `npm install` once and then `npm start` from `native-app`.