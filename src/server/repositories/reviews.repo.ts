import type { SqlExecutor } from "../db/types";
import type { ReviewSummary } from "@/features/midnight-review/summary";

export interface DailyReview {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  summary: ReviewSummary;
  presentedAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
}

interface Row {
  id: string;
  user_id: string;
  local_date: string;
  timezone: string;
  summary: ReviewSummary;
  presented_at: Date | null;
  dismissed_at: Date | null;
  created_at: Date;
}
const COLS = "id, user_id, local_date::text as local_date, timezone, summary, presented_at, dismissed_at, created_at";
const toReview = (r: Row): DailyReview => ({
  id: r.id,
  userId: r.user_id,
  localDate: r.local_date,
  timezone: r.timezone,
  summary: r.summary,
  presentedAt: r.presented_at,
  dismissedAt: r.dismissed_at,
  createdAt: r.created_at,
});

export async function insertReviewOnce(
  ex: SqlExecutor,
  userId: string,
  localDate: string,
  timezone: string,
  summary: ReviewSummary,
  now: Date,
): Promise<DailyReview | null> {
  const [row] = await ex.query<Row>(
    `insert into daily_reviews (user_id, local_date, timezone, summary, created_at)
     values ($1,$2::date,$3,$4::jsonb,$5)
     on conflict (user_id, local_date) do nothing
     returning ${COLS}`,
    [userId, localDate, timezone, JSON.stringify(summary), now],
  );
  return row ? toReview(row) : null;
}

export async function getReviewForDate(ex: SqlExecutor, userId: string, localDate: string): Promise<DailyReview | null> {
  const [row] = await ex.query<Row>(`select ${COLS} from daily_reviews where user_id=$1 and local_date=$2::date`, [userId, localDate]);
  return row ? toReview(row) : null;
}

export async function getReviewById(ex: SqlExecutor, userId: string, id: string): Promise<DailyReview | null> {
  const [row] = await ex.query<Row>(`select ${COLS} from daily_reviews where user_id=$1 and id=$2`, [userId, id]);
  return row ? toReview(row) : null;
}

export async function getLatestReview(ex: SqlExecutor, userId: string): Promise<DailyReview | null> {
  const [row] = await ex.query<Row>(`select ${COLS} from daily_reviews where user_id=$1 order by local_date desc limit 1`, [userId]);
  return row ? toReview(row) : null;
}

export async function markReview(ex: SqlExecutor, userId: string, id: string, action: "seen" | "dismiss", now: Date): Promise<DailyReview | null> {
  const sql =
    action === "seen"
      ? `update daily_reviews set presented_at = coalesce(presented_at, $3) where user_id=$1 and id=$2 returning ${COLS}`
      : `update daily_reviews set presented_at = coalesce(presented_at, $3), dismissed_at = coalesce(dismissed_at, $3) where user_id=$1 and id=$2 returning ${COLS}`;
  const [row] = await ex.query<Row>(sql, [userId, id, now]);
  return row ? toReview(row) : null;
}
