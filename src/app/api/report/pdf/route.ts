import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { calcStats } from '@/lib/stats';
import { type DailyPlanWithSlots } from '@/types/database';

export async function GET(request: NextRequest) {
  // 세션 쿠키로 uid 확인
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  // 날짜 범위의 플랜 조회
  const plansSnap = await adminDb
    .collection('users').doc(uid)
    .collection('daily_plans')
    .where('date', '>=', from)
    .where('date', '<=', to)
    .orderBy('date')
    .get();

  // 각 플랜의 time_slots + actual_logs 병렬 조회
  const plans: DailyPlanWithSlots[] = await Promise.all(
    plansSnap.docs.map(async (planDoc) => {
      const planData = planDoc.data() as { uid: string; date: string; created_at: string };
      const slotsSnap = await planDoc.ref.collection('time_slots').get();
      const slots = await Promise.all(
        slotsSnap.docs.map(async (slotDoc) => {
          const logsSnap = await slotDoc.ref.collection('actual_logs').get();
          return {
            ...slotDoc.data(),
            id: slotDoc.id,
            actual_logs: logsSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
          };
        })
      );
      return { ...planData, id: planDoc.id, time_slots: slots } as DailyPlanWithSlots;
    })
  );

  const rows = plans.map((plan) => {
    const stats = calcStats(plan as DailyPlanWithSlots);
    return `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb">${plan.date}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${Math.round(stats.completionRate)}%</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${Math.round(stats.timePunctuality)}%</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${stats.focusMinutes}분</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>TimeFlow 주간 리포트</title>
<style>
  body { font-family: sans-serif; padding: 40px; color: #111; }
  h1 { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #eff6ff; padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
</style>
</head>
<body>
<h1>TimeFlow 주간 리포트</h1>
<p>${from} ~ ${to}</p>
<table>
  <thead><tr><th>날짜</th><th>완료율</th><th>시간 준수율</th><th>집중 시간</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="timeflow-weekly-${from}-${to}.html"`,
    },
  });
}
