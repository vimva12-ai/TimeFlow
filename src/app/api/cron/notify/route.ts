import { NextResponse, type NextRequest } from 'next/server';
import webpush from 'web-push';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  webpush.setVapidDetails(
    'mailto:admin@timeflow.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? ''
  );

  // Bearer 토큰 인증
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);

  // Collection Group 쿼리: 현재 시각 기준 +5분 이내 시작하는 planned 슬롯 조회
  // ※ Firebase Console에서 복합 인덱스 생성 필요: time_slots (status ASC, start_at ASC)
  const slotsSnap = await adminDb
    .collectionGroup('time_slots')
    .where('status', '==', 'planned')
    .where('start_at', '>=', now.toISOString())
    .where('start_at', '<=', fiveMinLater.toISOString())
    .get();

  if (slotsSnap.empty) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  for (const slotDoc of slotsSnap.docs) {
    const slot = slotDoc.data();
    const uid = slot.uid as string;

    const subsSnap = await adminDb
      .collection('users').doc(uid)
      .collection('push_subscriptions')
      .get();

    for (const subDoc of subsSnap.docs) {
      const sub = subDoc.data();
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'TimeFlow 알림',
            body: `${slot.title} 슬롯이 곧 시작됩니다.`,
            slotId: slotDoc.id,
            url: '/today',
          })
        );
        sent++;
      } catch (e) {
        console.error('Push failed:', e);
      }
    }
  }

  return NextResponse.json({ sent });
}
