// ─── Strategy Pattern: Meeting Provider ─────────────────────────────────────
// The scheduling service calls only this interface.
// Swap providers by changing only the implementation class.

export interface MeetingProvider {
  generateLink(sessionId: string, slotStart: Date, slotEnd: Date): Promise<string>;
}

// Mock implementation — returns a simulated meet link
export class MockMeetingProvider implements MeetingProvider {
  async generateLink(sessionId: string, slotStart: Date, _slotEnd: Date): Promise<string> {
    const code = sessionId.slice(0, 8).toUpperCase();
    const ts = slotStart.getTime();
    return `https://meet.google.com/mock-meet-${code.toLowerCase()}`;
  }
}

// Placeholder for Google Meet integration
export class GoogleMeetProvider implements MeetingProvider {
  async generateLink(sessionId: string, _slotStart: Date, _slotEnd: Date): Promise<string> {
    // In production: call Google Calendar API to create event and extract meetingUri
    // For now: delegate to mock
    return new MockMeetingProvider().generateLink(sessionId, _slotStart, _slotEnd);
  }
}

// Active provider — change this line to swap providers
export const meetingProvider: MeetingProvider = new MockMeetingProvider();
