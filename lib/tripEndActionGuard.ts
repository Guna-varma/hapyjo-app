export function canSubmitTripEndAction(params: {
  hasEndPhoto: boolean;
  actionLocked: boolean;
  endTripInProgress: boolean;
  endingInProgress: boolean;
}): boolean {
  const { hasEndPhoto, actionLocked, endTripInProgress, endingInProgress } = params;
  return hasEndPhoto && !actionLocked && !endTripInProgress && !endingInProgress;
}
