/**
 * The single error-code → plain-language mapping the spec's Assumptions section refers to.
 * Constitution Principle III: no raw exception text, no error code without a human sentence.
 */

export const ERROR_MESSAGES = {
  INVALID_INPUT: 'Some details are missing or not valid. Check the highlighted fields and try again.',
  NOT_AUTHENTICATED: 'Please sign in to continue.',
  NOT_AUTHORIZED: 'This account does not have access to that.',
  BUSINESS_NOT_VERIFIED:
    'Your business is not verified yet, so this placement stays a draft. Verification needs a community reference and a trade licence on file.',
  RATE_BELOW_WAGE_FLOOR:
    'This hourly rate is below the legal minimum for that region. Raise the rate to publish.',
  DUPLICATE_APPLICATION: 'You have already applied to this placement.',
  PLACEMENT_NOT_OPEN: 'This placement is no longer accepting applications.',
  APPLICATION_NOT_FOUND: 'We could not find that application.',
  NOT_A_MINOR_APPLICATION: 'Guardian consent is only needed for applicants under 18.',
  GUARDIAN_CONSENT_REQUIRED:
    'A signed guardian consent document must be on file before this applicant can be accepted.',
  CAPACITY_EXCEEDED: 'This placement is already full. No further applicants can be accepted.',
  APPLICATION_ALREADY_DECIDED: 'A decision has already been recorded for this application.',
  ALREADY_TERMINAL: 'This application is already closed.',
  PLACEMENT_NOT_ACTIVE:
    'Competencies can only be signed off while the placement is active — not before it starts or after it ends.',
  NOT_PLACEMENT_MENTOR: 'Only the mentor running this placement can sign off competencies.',
  SELF_ENDORSEMENT_REJECTED: 'An organization cannot endorse itself or a business it operates.',
  UNEXPECTED: 'Something went wrong on our side. Please try again.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: ErrorCode; message: string; detail?: string };

export function fail(code: ErrorCode, detail?: string): ActionResult<never> {
  return { ok: false, code, message: ERROR_MESSAGES[code], detail };
}

/** Maps a thrown error (including Postgres errors) onto a known code. */
export function toErrorCode(error: unknown): ErrorCode {
  const text = error instanceof Error ? error.message : String(error);
  const known = (Object.keys(ERROR_MESSAGES) as ErrorCode[]).find((code) => text.includes(code));
  if (known) return known;
  if (/row-level security/i.test(text)) return 'NOT_AUTHORIZED';
  if (/duplicate key/i.test(text)) return 'DUPLICATE_APPLICATION';
  return 'UNEXPECTED';
}
