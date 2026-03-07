import { canSubmitTripEndAction } from '../tripEndActionGuard';

describe('canSubmitTripEndAction', () => {
  it('returns true when all guard conditions are satisfied', () => {
    expect(
      canSubmitTripEndAction({
        hasEndPhoto: true,
        actionLocked: false,
        endTripInProgress: false,
        endingInProgress: false,
      })
    ).toBe(true);
  });

  it('returns false when action is already locked', () => {
    expect(
      canSubmitTripEndAction({
        hasEndPhoto: true,
        actionLocked: true,
        endTripInProgress: false,
        endingInProgress: false,
      })
    ).toBe(false);
  });

  it('returns false when no end photo is available', () => {
    expect(
      canSubmitTripEndAction({
        hasEndPhoto: false,
        actionLocked: false,
        endTripInProgress: false,
        endingInProgress: false,
      })
    ).toBe(false);
  });
});
