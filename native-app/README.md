# Weight Tracker Native

Expo + React Native Android app for the Weight Tracker PWA.

## Development

```powershell
npm install
npm start
```

Run `npm run android` to open the app on a connected Android device/emulator. `npm run typecheck` checks the TypeScript source, and `npm run lint` checks the native code.

## Import data from the web app

In the PWA, open the profile menu and choose **Export for native app**. In this app, open the profile menu, choose **Import web app data**, and select the exported JSON file. Import replaces all native profiles and records. Weights remain stored internally in kilograms, so each profile's selected display unit is preserved.

## EAS APK

Sign in and configure/link the Expo project once:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Build an Android preview APK:

```powershell
npx eas-cli@latest build -p android --profile preview
```

The completed build page provides the APK download link. The production profile is configured to create an Android app bundle.
