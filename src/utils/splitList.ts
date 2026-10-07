// Shared by ComposeWindow (recipient validation) and the service (persistence)
export const splitList = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);
