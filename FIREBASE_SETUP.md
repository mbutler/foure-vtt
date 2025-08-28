# Firebase Setup Guide

## Current Issue
You're experiencing Firebase Firestore connection errors (400 Bad Request). This is likely due to missing Firebase project configuration or authentication issues.

**Note**: If you're using Bun and encounter Firebase CLI compatibility issues with Node.js, see `FIREBASE_SETUP_BUN.md` for manual setup instructions.

## Steps to Fix

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase Project
```bash
firebase init
```

Select the following options:
- Choose "Firestore" and "Hosting"
- Select your existing project "foure-vtt"
- Use the default Firestore rules file
- Use the default Firestore indexes file
- Set public directory to "public"
- Configure as single-page app: No
- Don't overwrite index.html

### 4. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 5. Enable Anonymous Authentication
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project "foure-vtt"
3. Go to Authentication > Sign-in method
4. Enable "Anonymous" authentication

### 6. Enable Firestore Database
1. In Firebase Console, go to Firestore Database
2. Click "Create database"
3. Choose "Start in test mode" (or use the rules we created)
4. Select a location close to your users

### 7. Update Security Rules (if needed)
If you want more restrictive rules, you can modify `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only allow authenticated users to access game data
    match /games/{sessionId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 8. Test the Connection
After completing the setup:
1. Restart your development server
2. Open the browser console
3. You should see "Firebase anonymous authentication successful"
4. The Firebase status should show "Connected"

## Alternative: Local-Only Mode
If you want to run without Firebase for development:
1. Set `NODE_ENV` to anything other than 'production'
2. The server will use in-memory storage instead of Firebase

## Troubleshooting

### Common Issues:
1. **400 Bad Request**: Usually means Firestore isn't enabled or rules are too restrictive
2. **Permission Denied**: Check that anonymous auth is enabled and rules allow access
3. **Service Unavailable**: Check that Firestore is enabled in the Firebase Console

### Debug Steps:
1. Check browser console for specific error messages
2. Verify Firebase project ID matches in both client and server config
3. Ensure Firestore is enabled in Firebase Console
4. Check that anonymous authentication is enabled
5. Verify Firestore rules are deployed correctly

## Current Configuration
Your app is configured to:
- Use anonymous authentication
- Connect to Firestore collection 'games'
- Fall back to local-only mode if Firebase is unavailable
- Show detailed connection status in the UI
