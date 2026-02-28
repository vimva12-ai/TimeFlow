'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { subscribeUser, unsubscribeUser } from '@/lib/webpush';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export default function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      );
    }
  }, []);

  async function toggle() {
    setLoading(true);
    if (subscribed) {
      await unsubscribeUser();
      setSubscribed(false);
    } else {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted === 'granted') {
        const ok = await subscribeUser();
        setSubscribed(ok);
      }
    }
    setLoading(false);
  }

  if (isIOS()) {
    return (
      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3 text-sm text-yellow-800 dark:text-yellow-300">
        iOS Safari는 Web Push 알림을 지원하지 않습니다.
        홈 화면에 추가한 경우 iOS 16.4 이상에서 지원됩니다.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-gray-900 dark:text-gray-100">슬롯 시작 알림</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">슬롯 시작 5분 전에 알림을 받습니다</div>
      </div>
      <button
        onClick={toggle}
        disabled={loading || permission === 'denied'}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          subscribed
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        } disabled:opacity-50`}
      >
        {subscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        {subscribed ? '알림 켜짐' : '알림 끄기'}
      </button>
    </div>
  );
}
