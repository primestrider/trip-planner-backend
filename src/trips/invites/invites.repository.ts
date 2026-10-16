import { Injectable } from "@nestjs/common";
import { Prisma, TripInvite, TripMemberRole } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

const inviteTripSelect = {
  trip: {
    select: {
      id: true,
      title: true,
      destination: true,
      startDate: true,
      endDate: true,
      user: { select: { username: true, name: true } }
    }
  }
} satisfies Prisma.TripInviteInclude;

export type InviteWithTrip = Prisma.TripInviteGetPayload<{
  include: typeof inviteTripSelect;
}>;

/**
 * InvitesRepository
 *
 * Repository responsible for interacting with the `trip_invites` table.
 */
@Injectable()
export class InvitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.TripInviteUncheckedCreateInput
  ): Promise<TripInvite> {
    return this.prisma.tripInvite.create({ data });
  }

  async findManyByTrip(tripId: string): Promise<TripInvite[]> {
    return this.prisma.tripInvite.findMany({
      where: { tripId },
      orderBy: { createdAt: "desc" }
    });
  }

  async findByIdAndTrip(
    inviteId: string,
    tripId: string
  ): Promise<TripInvite | null> {
    return this.prisma.tripInvite.findFirst({
      where: { id: inviteId, tripId }
    });
  }

  async findByTokenHash(tokenHash: string): Promise<InviteWithTrip | null> {
    return this.prisma.tripInvite.findUnique({
      where: { tokenHash },
      include: inviteTripSelect
    });
  }

  async revoke(inviteId: string): Promise<TripInvite> {
    return this.prisma.tripInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() }
    });
  }

  /**
   * Use one slot of the invite and add the user to the trip, atomically.
   *
   * The use is counted with a conditional update, so concurrent accepts
   * can never exceed `maxUses` or use a revoked / expired invite.
   *
   * @returns `false` if the invite can no longer be used
   */
  async redeem(
    invite: Pick<TripInvite, "id" | "tripId">,
    userId: string,
    role: TripMemberRole
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.tripInvite.updateMany({
        where: {
          id: invite.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          OR: [
            { maxUses: null },
            { useCount: { lt: tx.tripInvite.fields.maxUses } }
          ]
        },
        data: { useCount: { increment: 1 } }
      });

      if (count === 0) {
        return false;
      }

      await tx.tripMember.create({
        data: { tripId: invite.tripId, userId, role }
      });

      return true;
    });
  }
}
