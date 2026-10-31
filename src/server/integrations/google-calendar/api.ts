import { AppError } from "@/server/errors";
import type { GoogleEventResource } from "@/features/calendar/model";

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MAX_PAGES = 10;

export class GoogleAuthError extends Error {
  constructor() {
    super("Google rejected the access token");
  }
}

/**
 * Read-only `events.list` on the primary calendar.
 *  - singleEvents=true expands recurring events into individually-identified instances.
 *  - showDeleted=true surfaces cancelled instances so they can be marked.
 *  - `fields` limits the response: descriptions, attendees and conference data are never requested.
 * Throws GoogleAuthError on 401 so the caller can refresh once.
 */
export async function listGoogleEvents(
  accessToken: string,
  from: Date,
  to: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleEventResource[]> {
  const out: GoogleEventResource[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      orderBy: "startTime",
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      maxResults: "250",
      fields: "nextPageToken,items(id,status,summary,htmlLink,start,end)",
    });
    if (pageToken) q.set("pageToken", pageToken);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let res: Response;
    try {
      res = await fetchImpl(`${EVENTS_URL}?${q.toString()}`, { headers: { authorization: `Bearer ${accessToken}` }, signal: ctrl.signal });
    } catch {
      throw new AppError(502, "calendar_unavailable", "Google Calendar could not be reached. Your tasks are unaffected.");
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401) throw new GoogleAuthError();
    if (res.status === 403 || res.status === 429) throw new AppError(502, "calendar_rate_limited", "Google Calendar is limiting requests. Try again later.");
    if (!res.ok) throw new AppError(502, "calendar_unavailable", "Google Calendar returned an error. Your tasks are unaffected.");
    const body = (await res.json()) as { items?: GoogleEventResource[]; nextPageToken?: string };
    out.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}
