// ============================================================
// TimeFlow — Database Types (Firestore)
// ============================================================

export type SlotStatus = 'planned' | 'done' | 'partial' | 'skipped';

// ── users ────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  timezone: string;
  created_at: string;
}

// ── daily_plans ───────────────────────────────────────────────
export interface DailyPlan {
  id: string;      // {uid}_{date} — Firestore doc ID
  uid: string;     // Firebase Auth UID
  date: string;    // YYYY-MM-DD
  created_at: string;
}

// ── time_slots ────────────────────────────────────────────────
export interface TimeSlot {
  id: string;
  uid: string;       // Firebase Auth UID (Collection Group 쿼리용)
  planId: string;    // {uid}_{date}
  title: string;
  start_at: string;  // ISO timestamp
  end_at: string;    // ISO timestamp
  status: SlotStatus;
  sort_order: number;
  created_at: string;
}

export type TimeSlotInsert = {
  title: string;
  start_at: string;
  end_at: string;
  status?: SlotStatus;
  sort_order?: number;
};

// ── actual_logs ───────────────────────────────────────────────
export interface ActualLog {
  id: string;
  actual_start: string | null;  // ISO timestamp
  actual_end: string | null;    // ISO timestamp
  note: string | null;
  created_at: string;
}

// ── templates ─────────────────────────────────────────────────
export interface TemplateSlotJson {
  title: string;
  offsetMinutes: number;   // 하루 시작(00:00)으로부터의 분 단위 오프셋
  durationMinutes: number;
  sort_order: number;
}

export interface Template {
  id: string;
  uid: string;
  name: string;
  slots_json: TemplateSlotJson[];
  created_at: string;
}

// ── Composite types ───────────────────────────────────────────
export type TimeSlotWithLogs = TimeSlot & {
  actual_logs: ActualLog[];
};

export type DailyPlanWithSlots = DailyPlan & {
  time_slots: TimeSlotWithLogs[];
};
