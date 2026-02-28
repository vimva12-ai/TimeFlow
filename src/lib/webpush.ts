'use client';

import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function endpointToDocId(endpoint: string): string {
  return btoa(endpoint).replace(/[/+=]/g, '_').slice(0, 128);
}

export async function subscribeUser(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  });

  const { endpoint, keys } = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  const subRef = doc(db, 'users', uid, 'push_subscriptions', endpointToDocId(endpoint));
  try {
    await setDoc(subRef, {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      created_at: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeUser(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  const { endpoint } = subscription;
  await subscription.unsubscribe();

  await deleteDoc(doc(db, 'users', uid, 'push_subscriptions', endpointToDocId(endpoint)));
  return true;
}
