import prisma from '../../db/prismaClient';

// ─── Ranking Score Engine ────────────────────────────────────────────────────
// Computes weighted ranking score from 4 signals and persists to AlumniProfile.
// Never called at query time — only on relevant domain events.

const WEIGHTS = {
  profileCompleteness: 0.25,
  sessionsConducted: 0.30,
  responseRate: 0.30,
  domainOverlap: 0.15, // Base overlap contribution (student-agnostic portion)
};

export class RankingScoreEngine {
  /**
   * Recompute and persist ranking_score for a given alumni.
   * Called after: session.completed, request.accepted/declined
   */
  async recompute(alumniId: string): Promise<void> {
    const alumniProfile = await prisma.alumniProfile.findUnique({
      where: { userId: alumniId },
      include: { domainTags: true },
    });
    if (!alumniProfile) return;

    // Signal 1: Profile completeness
    const completeness = this.computeCompleteness(alumniProfile);

    // Signal 2: Sessions conducted (normalised, cap at 50)
    const sessionsScore = Math.min(alumniProfile.sessionsConducted / 50, 1);

    // Signal 3: Response rate (already 0–1)
    const responseRate = alumniProfile.responseRate;

    // Signal 4: Domain tag count as a proxy for domain overlap potential (0–1, cap at 10 tags)
    const tagCoverage = Math.min((alumniProfile.domainTags?.length || 0) / 10, 1);

    const score =
      WEIGHTS.profileCompleteness * completeness +
      WEIGHTS.sessionsConducted * sessionsScore +
      WEIGHTS.responseRate * responseRate +
      WEIGHTS.domainOverlap * tagCoverage;

    const updatedCompleteness = completeness;

    await prisma.alumniProfile.update({
      where: { userId: alumniId },
      data: {
        rankingScore: score,
        profileCompletenessScore: updatedCompleteness,
      },
    });
  }

  private computeCompleteness(profile: {
    bio: string | null;
    company: string | null;
    jobTitle: string | null;
    experienceYears: number | null;
    linkedinUrl: string | null;
    documentUrl: string | null;
  }): number {
    const fields = [
      profile.bio,
      profile.company,
      profile.jobTitle,
      profile.experienceYears,
      profile.linkedinUrl,
      profile.documentUrl,
    ];
    const filled = fields.filter((f) => f !== null && f !== undefined && f !== '').length;
    return filled / fields.length;
  }

  /**
   * Update response rate after a request is accepted or declined.
   */
  async updateResponseRate(alumniId: string): Promise<void> {
    const total = await prisma.mentorshipRequest.count({ where: { alumniId } });
    const accepted = await prisma.mentorshipRequest.count({
      where: { alumniId, status: 'accepted' },
    });
    if (total === 0) return;

    const rate = accepted / total;
    await prisma.alumniProfile.update({
      where: { userId: alumniId },
      data: { responseRate: rate },
    });
  }

  /**
   * Increment sessions conducted count.
   */
  async incrementSessions(alumniId: string): Promise<void> {
    await prisma.alumniProfile.update({
      where: { userId: alumniId },
      data: { sessionsConducted: { increment: 1 } },
    });
  }
}

export const rankingScoreEngine = new RankingScoreEngine();
