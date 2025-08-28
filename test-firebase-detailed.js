#!/usr/bin/env bun

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
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

console.log('🔍 Detailed Firebase Connection Test...\n');

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
  console.log(`   Is Anonymous: ${userCredential.user.isAnonymous}`);

  // Test basic Firestore operations
  console.log('5. Testing Firestore operations...');
  
  // Test 1: Try to read from a test document
  console.log('   a) Testing read from test document...');
  try {
    const testDoc = doc(db, 'test', 'connection-test');
    const docSnap = await getDoc(testDoc);
    console.log('   ✅ Read operation successful');
    console.log(`      Document exists: ${docSnap.exists()}`);
  } catch (readError) {
    console.log('   ❌ Read operation failed:', readError.code);
    console.log('      Error message:', readError.message);
  }

  // Test 2: Try to write to a test document
  console.log('   b) Testing write to test document...');
  try {
    const testDoc = doc(db, 'test', 'connection-test');
    await setDoc(testDoc, {
      timestamp: new Date(),
      test: true,
      message: 'Firebase connection test'
    });
    console.log('   ✅ Write operation successful');
  } catch (writeError) {
    console.log('   ❌ Write operation failed:', writeError.code);
    console.log('      Error message:', writeError.message);
  }

  // Test 3: Try to list collections
  console.log('   c) Testing collection listing...');
  try {
    const collections = await getDocs(collection(db, 'test'));
    console.log('   ✅ Collection listing successful');
    console.log(`      Found ${collections.size} documents in test collection`);
  } catch (listError) {
    console.log('   ❌ Collection listing failed:', listError.code);
    console.log('      Error message:', listError.message);
  }

  // Test 4: Try to access the games collection specifically
  console.log('   d) Testing games collection access...');
  try {
    const gamesCollection = collection(db, 'games');
    const gamesDocs = await getDocs(gamesCollection);
    console.log('   ✅ Games collection access successful');
    console.log(`      Found ${gamesDocs.size} game documents`);
  } catch (gamesError) {
    console.log('   ❌ Games collection access failed:', gamesError.code);
    console.log('      Error message:', gamesError.message);
  }

  console.log('\n🎉 Firebase test completed!');
  console.log('\nIf you see any ❌ errors above, you need to:');
  console.log('1. Go to Firebase Console > Firestore Database');
  console.log('2. Make sure the database is created');
  console.log('3. Go to Rules tab and update with permissive rules');
  console.log('4. Click Publish');

} catch (error) {
  console.error('\n❌ Firebase test failed:', error.message);
  console.error('Error code:', error.code);
  
  if (error.code === 'permission-denied') {
    console.log('\n💡 This means Firestore rules are too restrictive.');
    console.log('   Update your Firestore rules to allow anonymous access.');
  } else if (error.code === 'unavailable') {
    console.log('\n💡 This means Firestore Database is not enabled.');
    console.log('   Create the Firestore Database in Firebase Console.');
  } else if (error.code === 'unauthenticated') {
    console.log('\n💡 This means Anonymous Authentication is not enabled.');
    console.log('   Enable Anonymous Authentication in Firebase Console.');
  }
  
  process.exit(1);
}
