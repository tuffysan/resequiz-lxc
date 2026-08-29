# Resequiz Mobile

Mobilapp för https://quiz.nilsson.ink med mobil-först native skal och återanvändning av den befintliga spelmotorn.

## Ingår

- Native mobil-startsida
- Starta quizkväll
- Gå med via rumskod
- Spela själv
- Quizmaster
- Hall of Fame
- Android back-knapp
- Delning
- Fel/offline-vy
- Externa länkar öppnas utanför appen
- Cookies/local storage bevaras i WebView för spelsessioner
- Android APK-profil i `eas.json`

## Kör på Android

1. Installera Node.js.
2. Packa upp projektet.
3. Kör:

```bash
npm install
npx expo start
```

Installera Expo Go på Android och skanna QR-koden.

## Bygg riktig APK

```bash
npm install
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Profilen `preview` skapar APK. `production` skapar Android App Bundle (AAB) för Google Play.

## App-ID

Android package:
`ink.nilsson.resequiz`

iOS bundle identifier:
`ink.nilsson.resequiz`

## Server

Alla spelvyer använder:
`https://quiz.nilsson.ink`

Ändra `BASE_URL` högst upp i `App.tsx` om serveradressen ändras.

## Arkitektur

Appens navigation och startsida är native React Native. Befintliga live-spelvyer laddas i en inbyggd WebView, vilket gör att webbens rum, realtid, frågor och sessionslogik kan användas direkt utan en separat mobil-backend.

Nästa naturliga steg för en helt native spelmotor är att exponera samma REST/WebSocket-protokoll som webbklienten använder och ersätta WebView-skärmen stegvis.
