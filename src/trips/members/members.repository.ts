import { Injectable } from "@nestjs/common";
import { Prisma, TripMember, TripMemberRole } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

/**
 * Public user fields shown in the member list
 */
export const memberUserSelect = {
  id: true,
  username: true,
  name: true,
  avatar: { select: { id: true, url: true } }
} satisfies Prisma.UserSelect;

export type MemberUser = Prisma.UserGetPayload<{
  select: typeof memberUserSelect;
}>;

export type TripMemberWithUser = TripMember & { user: MemberUser };

/**
 * MembersRepository
 *
 * Repository responsible for interacting with the `trip_members` table.
 * Access to the trip is checked by the caller.
 */
@Injectable()
export class MembersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOwner(ownerId: string): Promise<MemberUser | null> {
    return this.prisma.user.findUnique({
      where: { id: ownerId },
      select: memberUserSelect
    });
  }

  /**
   * List collaborators of a trip in join order.
   */
  async findManyByTrip(tripId: string): Promise<TripMemberWithUser[]> {
    return this.prisma.tripMember.findMany({
      where: { tripId },
      include: { user: { select: memberUserSelect } },
      orderBy: { createdAt: "asc" }
    });
  }

  async findByTripAndUser(
    tripId: string,
    userId: string
  ): Promise<TripMember | null> {
    return this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } }
    });
  }

  async create(
    tripId: string,
    userId: string,
    role: TripMemberRole
  ): Promise<TripMemberWithUser> {
    return this.prisma.tripMember.create({
      data: { tripId, userId, role },
      include: { user: { select: memberUserSelect } }
    });
  }

  async updateRole(
    memberId: string,
    role: TripMemberRole
  ): Promise<TripMemberWithUser> {
    return this.prisma.tripMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: memberUserSelect } }
    });
  }

  async delete(memberId: string): Promise<void> {
    await this.prisma.tripMember.delete({
      where: { id: memberId }
    });
  }
}
