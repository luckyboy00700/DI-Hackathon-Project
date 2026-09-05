import { describe, expect, it } from 'vitest';
import { endorseInput } from '@/lib/validation/schemas';
import { ERROR_MESSAGES } from '@/lib/errors';

/** T073 — contract test for endorse (contracts/server-actions.md). */

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('endorse input contract', () => {
  it('accepts an apprentice subject', () => {
    expect(endorseInput.safeParse({ subjectType: 'apprentice', subjectId: UUID }).success).toBe(true);
  });

  it('accepts a business subject', () => {
    expect(endorseInput.safeParse({ subjectType: 'business', subjectId: UUID }).success).toBe(true);
  });

  it('rejects a subject type outside the closed set', () => {
    expect(endorseInput.safeParse({ subjectType: 'organization', subjectId: UUID }).success).toBe(
      false,
    );
  });

  it('rejects a non-uuid subject id', () => {
    expect(endorseInput.safeParse({ subjectType: 'apprentice', subjectId: 'someone' }).success).toBe(
      false,
    );
  });

  it('takes no organization id — the endorser is the session user', () => {
    // If the client could name the endorsing organization, anyone could forge a reference.
    const parsed = endorseInput.safeParse({
      subjectType: 'apprentice',
      subjectId: UUID,
      organizationId: UUID,
    });
    expect(parsed.success && 'organizationId' in parsed.data).toBe(false);
  });

  it('carries no free-text field for a character assessment (FR-005)', () => {
    const parsed = endorseInput.safeParse({
      subjectType: 'apprentice',
      subjectId: UUID,
      comment: 'A fine young person',
    });
    expect(parsed.success && 'comment' in parsed.data).toBe(false);
  });

  it('publishes a plain-language sentence for the self-endorsement refusal', () => {
    expect(ERROR_MESSAGES.SELF_ENDORSEMENT_REJECTED).toMatch(/cannot endorse itself/i);
  });
});
