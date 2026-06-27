# Zoom Session Recorder

App Android (Kotlin + Jetpack Compose) qui enregistre une session Zoom via le
micro du téléphone, puis transcrit l'audio en texte et génère un résumé long
et structuré.

## Pourquoi le micro et pas une "vraie" capture de l'app Zoom ?

Sur Android, l'API `AudioPlaybackCapture` (utilisée pour enregistrer le son
joué par une autre app) **exclut explicitement les flux marqués
`USAGE_VOICE_COMMUNICATION`**, ce qui inclut l'audio des appels Zoom. Il
n'existe donc pas de méthode officielle pour qu'une app tierce capture
directement la voix des autres participants Zoom sans intégrer le SDK Zoom
lui-même (ce que tu voulais éviter).

La solution simple et fiable : enregistrer via le micro du téléphone pendant
que Zoom est en haut-parleur. Ça capture ta voix + celle des participants qui
sortent du haut-parleur, exactement comme un dictaphone posé sur la table.

## Fonctionnement

1. **Enregistrement** : un bouton démarre/arrête un `Service` au premier plan
   qui enregistre le micro (`MediaRecorder`, format `.m4a`) même si l'app
   passe en arrière-plan.
2. **Transcription** : à l'arrêt, l'audio est envoyé à l'API Whisper
   d'OpenAI (`/v1/audio/transcriptions`) via un `WorkManager` worker, pour
   survivre même si l'app est fermée.
3. **Résumé** : la transcription est envoyée à l'API Claude (Anthropic,
   `/v1/messages`) pour générer un résumé long en français (sujets,
   décisions, actions à faire, points en suspens).
4. **Stockage** : les sessions (titre, statut, transcription, résumé) sont
   stockées localement en JSON dans le stockage privé de l'app. Les clés API
   sont stockées chiffrées via `EncryptedSharedPreferences` (Android
   Keystore) — elles ne sont jamais committées dans le code.

## Structure du projet

```
app/src/main/java/com/michel/zoomrecorder/
  MainActivity.kt              Permissions + point d'entrée Compose
  recording/RecordingService.kt  Service au premier plan, enregistrement micro
  data/Session.kt               Modèle de données d'une session
  data/SessionRepository.kt     Persistance JSON locale + StateFlow
  data/SecurePrefs.kt           Clés API chiffrées
  network/WhisperApi.kt         Appel API transcription (OpenAI Whisper)
  network/ClaudeApi.kt          Appel API résumé (Anthropic Claude)
  work/ProcessRecordingWorker.kt WorkManager : transcrire puis résumer
  ui/                           Écrans Compose (Accueil, Détail, Réglages)
```

## Configuration requise avant utilisation

Dans l'app, va dans **Réglages** et entre :
- Une clé API OpenAI (pour Whisper) : https://platform.openai.com/api-keys
- Une clé API Anthropic (pour le résumé Claude) : https://console.anthropic.com/

Ces clés restent uniquement sur l'appareil, chiffrées.

## Build

```bash
./gradlew assembleDebug
```

L'APK debug est généré dans `app/build/outputs/apk/debug/`.

> **Note** : ce projet a été écrit dans un environnement sans SDK Android et
> sans accès au dépôt Maven de Google (`dl.google.com` bloqué par le proxy
> réseau), donc le build n'a **pas pu être vérifié par compilation** ici.
> Ouvre le projet dans Android Studio (qui a accès au SDK et aux dépôts
> Google) pour la première compilation — corrige tout écart de version de
> dépendance si besoin.

## Permissions utilisées

- `RECORD_AUDIO` : enregistrement micro
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MICROPHONE` : enregistrement
  fiable même app en arrière-plan
- `POST_NOTIFICATIONS` : notification d'enregistrement en cours + résumé prêt
- `INTERNET` : appels aux API Whisper et Claude

## Limites connues

- minSdk 26 (Android 8.0+).
- Aucune intégration directe avec l'app Zoom : c'est volontaire (voir
  ci-dessus). La qualité de la transcription dépend du bruit ambiant et du
  volume du haut-parleur.
- Pas de gestion multi-device / cloud : tout reste en local sur le téléphone.
