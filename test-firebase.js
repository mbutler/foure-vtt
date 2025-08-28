#!/usr/bin/env bun

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA23NUgigHUu8f-3CkQCzogM-iHKg5TG_g",
  authDomain: "foure-vtt.firebaseapp.com",
  projectId: "foure-vtt",
  storageBucket: "foure-vtt.firebasestorage.app",
  messagingSenderId: "1006635005126",
  appId: "1:1006635005126:web:8254af5e2686e7b78313c7",
  measurementId: "G-QBWFERVWQS"
};

console.log('🧪 Testing Firebase Connection...\n');

try {
  // Initialize Firebase
  console.log('1. Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized');

  // Initialize Firestore
  console.log('2. Initializing Firestore...');
  const db = getFirestore(app);
  console.log('✅ Firestore initialized');

  // Initialize Auth
  console.log('3. Initializing Authentication...');
  const auth = getAuth(app);
  console.log('✅ Authentication initialized');

  // Test anonymous authentication
  console.log('4. Testing anonymous authentication...');
  const userCredential = await signInAnonymously(auth);
  console.log('✅ Anonymous authentication successful');
  console.log(`   User ID: ${userCredential.user.uid}`);

  // Test Firestore read
  console.log('5. Testing Firestore read...');
  const testDoc = doc(db, 'games', 'test');
  const docSnap = await getDoc(testDoc);
  
  if (docSnap.exists()) {
    console.log('✅ Firestore read successful (document exists)');
  } else {
    console.log('✅ Firestore read successful (document does not exist - this is normal)');
  }

  console.log('\n🎉 All Firebase tests passed!');
  console.log('\nYour Firebase configuration is working correctly.');
  console.log('You can now run your app with Firebase enabled.');

} catch (error) {
  console.error('\n❌ Firebase test failed:', error.message);
  
  if (error.code === 'permission-denied') {
    console.log('\n💡 This usually means:');
    console.log('   - Firestore Database is not created');
    console.log('   - Anonymous Authentication is not enabled');
    console.log('   - Security rules are too restrictive');
    console.log('\n   Follow the manual setup steps in FIREBASE_SETUP_BUN.md');
  } else if (error.code === 'unavailable') {
    console.log('\n💡 This usually means:');
    console.log('   - Firestore Database is not enabled');
    console.log('   - Network connectivity issues');
  } else if (error.code === 'unauthenticated') {
    console.log('\n💡 This usually means:');
    console.log('   - Anonymous Authentication is not enabled');
  }
  
  process.exit(1);
}
