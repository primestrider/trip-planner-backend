import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

const userSelect = { id: true, username: true, name: true } as const;

const usersInclude = {
  assignedTo: { select: userSelect },
  checkedBy: { select: userSelect }
} satisfies Prisma.TripChecklistItemInclude;

export type ChecklistItemWithUsers = Prisma.TripChecklistItemGetPayload<{
  include: typeof usersInclude;
}>;

/**
 * ChecklistRepository
 *
 * Repository responsible for interacting with the `trip_checklist_items`
 * table. Queries are scoped by `tripId`; access is checked by the caller.
 */
@Injectable()
export class ChecklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.TripChecklistItemUncheckedCreateInput
  ): Promise<ChecklistItemWithUsers> {
    return this.prisma.tripChecklistItem.create({
      data,
      include: usersInclude
    });
  }

  async findByIdAndTrip(
    itemId: string,
    tripId: string
  ): Promise<ChecklistItemWithUsers | null> {
    return this.prisma.tripChecklistItem.findFirst({
      where: { id: itemId, tripId },
      include: usersInclude
    });
  }

  /**
   * List items: unchecked first, then by category and creation order.
   */
  async findManyByTrip(
    tripId: string,
    isChecked?: boolean
  ): Promise<ChecklistItemWithUsers[]> {
    return this.prisma.tripChecklistItem.findMany({
      where: { tripId, ...(isChecked !== undefined && { isChecked }) },
      include: usersInclude,
      orderBy: [
        { isChecked: "asc" },
        { category: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" }
      ]
    });
  }

  /**
   * Total and checked item counts of a trip
   */
  async countByTrip(
    tripId: string
  ): Promise<{ total: number; checked: number }> {
    const [total, checked] = await this.prisma.$transaction([
      this.prisma.tripChecklistItem.count({ where: { tripId } }),
      this.prisma.tripChecklistItem.count({
        where: { tripId, isChecked: true }
      })
    ]);

    return { total, checked };
  }

  async update(
    itemId: string,
    data: Prisma.TripChecklistItemUncheckedUpdateInput
  ): Promise<ChecklistItemWithUsers> {
    return this.prisma.tripChecklistItem.update({
      where: { id: itemId },
      data,
      include: usersInclude
    });
  }

  async delete(itemId: string): Promise<void> {
    await this.prisma.tripChecklistItem.delete({
      where: { id: itemId }
    });
  }
}
