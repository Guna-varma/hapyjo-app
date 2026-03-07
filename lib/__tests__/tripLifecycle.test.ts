import { canTransition } from '../tripLifecycle';

describe('trip lifecycle transitions', () => {
  it('allows driver to move TRIP_STARTED -> TRIP_NEED_APPROVAL', () => {
    expect(canTransition('TRIP_STARTED', 'TRIP_NEED_APPROVAL', 'driver')).toBe(true);
  });

  it('allows driver to move TRIP_RESUMED -> TRIP_NEED_APPROVAL', () => {
    expect(canTransition('TRIP_RESUMED', 'TRIP_NEED_APPROVAL', 'driver')).toBe(true);
  });

  it('allows driver to move TRIP_PAUSED -> TRIP_NEED_APPROVAL', () => {
    expect(canTransition('TRIP_PAUSED', 'TRIP_NEED_APPROVAL', 'driver')).toBe(true);
  });

  it('still blocks skipping ASSIGNED -> COMPLETED for driver', () => {
    expect(canTransition('TRIP_ASSIGNED', 'TRIP_COMPLETED', 'driver')).toBe(false);
  });
});
