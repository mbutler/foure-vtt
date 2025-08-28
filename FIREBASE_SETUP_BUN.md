# Firebase Setup Guide for Bun

## Current Issue
Firebase CLI v14.15.0 is incompatible with Node.js v16.20.2. Since you're using Bun, we'll set up Firebase manually through the web console.

## Manual Setup Steps

### 1. Enable Firestore Database
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project "foure-vtt"
3. In the left sidebar, click "Firestore Database"
4. Click "Create database"
5. Choose "Start in test mode" (we'll update rules later)
6. Select a location close to your users (e.g., "us-central1")
7. Click "Done"

### 2. Enable Anonymous Authentication
1. In Firebase Console, click "Authentication" in the left sidebar
2. Click "Get started" if you haven't set up Authentication yet
3. Click the "Sign-in method" tab
4. Click "Anonymous" in the list of providers
5. Toggle the switch to "Enable"
6. Click "Save"

### 3. Update Firestore Security Rules
1. In Firebase Console, go to "Firestore Database"
2. Click the "Rules" tab
3. Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anonymous users to read and write game sessions
    match /games/{sessionId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow anonymous users to read and write any document in the games collection
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click "Publish"

### 4. Test the Connection
1. Restart your development server:
   ```bash
   bun simple-server.js
   ```

2. Open your browser to `http://localhost:8000`

3. Open the browser console (F12)

4. You should see:
   - "Firebase client SDK initialized successfully"
   - "Firebase: Connected" in the status indicator

## Alternative: Local-Only Mode

If you want to run without Firebase for development, your app is already configured to do this. The Firebase client will only be enabled when:
- You're not on localhost (production)
- OR you explicitly enable it with `localStorage.setItem('enableFirebase', 'true')`

To force Firebase on localhost for testing:
1. Open browser console
2. Run: `localStorage.setItem('enableFirebase', 'true')`
3. Refresh the page

## Troubleshooting

### Common Issues:

1. **400 Bad Request**: 
   - Make sure Firestore Database is created
   - Check that Anonymous Authentication is enabled
   - Verify the security rules are published

2. **Permission Denied**:
   - Ensure Anonymous Authentication is enabled
   - Check that the security rules allow authenticated users

3. **Service Unavailable**:
   - Verify Firestore Database is created and active
   - Check the selected region is appropriate

### Debug Steps:
1. Check browser console for specific error messages
2. Verify your Firebase project ID is "foure-vtt"
3. Ensure both Firestore and Authentication are enabled
4. Check that security rules are published

## Current Configuration

Your app is configured to:
- Use anonymous authentication
- Connect to Firestore collection 'games'
- Only enable Firebase client in production or when explicitly enabled
- Fall back to local-only mode if Firebase is unavailable
- Show connection status in the UI

## Next Steps

After completing the setup:
1. Your app should work with real-time synchronization
2. Multiple users can join the same session
3. Game state will persist across browser sessions
4. You can deploy to production with Firebase hosting

To deploy to production later:
```bash
# Install Firebase CLI globally (if you upgrade Node.js)
npm install -g firebase-tools

# Or use the web interface at https://console.firebase.google.com/
# Go to Hosting > Get started
```
