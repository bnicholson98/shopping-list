import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, deleteToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import app from '../firebase';

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

export default function useNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSupported =
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported) { setLoading(false); return; }

    (async () => {
      try {
        const user = auth.currentUser;
        if (!user || Notification.permission !== 'granted') return;

        const snap = await getDoc(doc(db, 'fcmTokens', user.uid));
        if (!snap.exists()) return;

        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg
        });

        if (token) {
          setIsSubscribed(true);
          if (snap.data().token !== token) {
            await setDoc(doc(db, 'fcmTokens', user.uid), { token }, { merge: true });
          }
        }
      } catch (e) {
        console.error('Notification check failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    try {
      setLoading(true);
      setError(null);

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError(permission === 'denied'
          ? 'Blocked — enable in device settings'
          : 'Permission not granted');
        return false;
      }

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { setError('Service worker not available'); return false; }

      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: reg
      });
      if (!token) { setError('Could not get push token'); return false; }

      const user = auth.currentUser;
      if (!user) { setError('Not signed in'); return false; }

      await setDoc(doc(db, 'fcmTokens', user.uid), {
        token,
        uid: user.uid,
        createdAt: serverTimestamp()
      });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Subscribe failed:', e);
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const messaging = getMessaging(app);
      await deleteToken(messaging);

      const user = auth.currentUser;
      if (user) await deleteDoc(doc(db, 'fcmTokens', user.uid));

      setIsSubscribed(false);
    } catch (e) {
      console.error('Unsubscribe failed:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, loading, error, subscribe, unsubscribe };
}