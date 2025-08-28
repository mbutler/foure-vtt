#!/usr/bin/env bun

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🚀 Firebase Setup Helper for 4e VTT');
console.log('=====================================\n');

// Check if Firebase CLI is installed
try {
  execSync('firebase --version', { stdio: 'pipe' });
  console.log('✅ Firebase CLI is installed');
} catch (error) {
      console.log('❌ Firebase CLI not found. Installing...');
    try {
      execSync('bun add -g firebase-tools', { stdio: 'inherit' });
      console.log('✅ Firebase CLI installed successfully');
    } catch (installError) {
      console.error('❌ Failed to install Firebase CLI:', installError.message);
      console.log('Please install manually: bun add -g firebase-tools');
      process.exit(1);
    }
}

// Check if user is logged in
try {
  execSync('firebase projects:list', { stdio: 'pipe' });
  console.log('✅ Firebase CLI is logged in');
} catch (error) {
  console.log('❌ Not logged in to Firebase. Please run:');
  console.log('   firebase login');
  console.log('Then run this script again.');
  process.exit(1);
}

// Check if firebase.json exists
if (!existsSync('firebase.json')) {
  console.log('❌ firebase.json not found. Creating...');
  try {
    execSync('firebase init firestore', { 
      stdio: 'inherit',
      input: Buffer.from([
        'foure-vtt\n', // Select project
        'firestore.rules\n', // Rules file
        'firestore.indexes.json\n', // Indexes file
        'N\n' // Don't overwrite existing files
      ].join(''))
    });
    console.log('✅ Firebase project initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase project:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ firebase.json exists');
}

// Deploy Firestore rules
console.log('\n📤 Deploying Firestore rules...');
try {
  execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
  console.log('✅ Firestore rules deployed successfully');
} catch (error) {
  console.error('❌ Failed to deploy Firestore rules:', error.message);
  console.log('You may need to enable Firestore in the Firebase Console first.');
}

console.log('\n🎉 Setup complete!');
console.log('\nNext steps:');
console.log('1. Go to https://console.firebase.google.com/');
console.log('2. Select your project "foure-vtt"');
console.log('3. Go to Authentication > Sign-in method');
console.log('4. Enable "Anonymous" authentication');
console.log('5. Go to Firestore Database');
console.log('6. Create database if not already created');
console.log('7. Restart your development server');
console.log('8. Check the browser console for connection status');
