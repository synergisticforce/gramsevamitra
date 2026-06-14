export interface MeetingAttendee {
  id: string;
  label: string;
  hourlyRate: number;
}

export interface MeetingCostResult {
  durationMinutes: number;
  totalHourlyBurn: number;
  meetingCost: number;
  perAttendee: { id: string; label: string; cost: number }[];
}

export function calculateMeetingCost(
  attendees: MeetingAttendee[],
  durationMinutes: number
): MeetingCostResult {
  const durationHours = Math.max(0, durationMinutes) / 60;
  const active = attendees.filter((a) => a.hourlyRate > 0);
  const totalHourlyBurn = active.reduce((sum, a) => sum + a.hourlyRate, 0);
  const meetingCost = totalHourlyBurn * durationHours;

  return {
    durationMinutes: Math.max(0, durationMinutes),
    totalHourlyBurn,
    meetingCost,
    perAttendee: active.map((a) => ({
      id: a.id,
      label: a.label,
      cost: a.hourlyRate * durationHours,
    })),
  };
}
