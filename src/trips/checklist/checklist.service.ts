import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Trip } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { MembersRepository } from "../members/members.repository";
import {
  ChecklistItemWithUsers,
  ChecklistRepository
} from "./checklist.repository";
import {
  ChecklistItemResponse,
  ChecklistResponse,
  ChecklistUser
} from "./models";
import {
  CreateChecklistItemDto,
  ListChecklistQuery,
  UpdateChecklistItemDto
} from "./checklist.validation";
import { ActivityPublisher } from "../activity/activity.events";

function toChecklistUser(
  user: { id: string; username: string; name: string | null } | null
): ChecklistUser | null {
  return user
    ? { userId: user.id, username: user.username, name: user.name }
    : null;
}

/**
 * ChecklistService manages the packing list / to-dos of a trip.
 * Any member can read; EDITOR or OWNER can change and tick items.
 */
@Injectable()
export class ChecklistService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly checklistRepository: ChecklistRepository,
    private readonly membersRepository: MembersRepository,
    private readonly activity: ActivityPublisher,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private toResponse(item: ChecklistItemWithUsers): ChecklistItemResponse {
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      assignedTo: toChecklistUser(item.assignedTo),
      isChecked: item.isChecked,
      checkedAt: item.checkedAt,
      checkedBy: toChecklistUser(item.checkedBy),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  /**
   * @throws BadRequestException if the assignee is not on the trip
   */
  private async ensureAssignee(trip: Trip, userId: string): Promise<void> {
    const participants = await this.membersRepository.findParticipantIds(trip);

    if (!participants.includes(userId)) {
      throw new BadRequestException(
        "Checklist items can only be assigned to trip members"
      );
    }
  }

  /**
   * @throws NotFoundException if the item does not belong to the trip
   */
  private async findItem(
    tripId: string,
    itemId: string
  ): Promise<ChecklistItemWithUsers> {
    const item = await this.checklistRepository.findByIdAndTrip(itemId, tripId);

    if (!item) {
      throw new NotFoundException("Checklist item not found");
    }

    return item;
  }

  async list(
    userId: string,
    tripId: string,
    query: ListChecklistQuery
  ): Promise<ChecklistResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const isChecked =
      query.checked === undefined ? undefined : query.checked === "true";

    const [items, counts] = await Promise.all([
      this.checklistRepository.findManyByTrip(trip.id, isChecked),
      this.checklistRepository.countByTrip(trip.id)
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      ...counts
    };
  }

  async create(
    userId: string,
    tripId: string,
    payload: CreateChecklistItemDto
  ): Promise<ChecklistItemResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");

    if (payload.assignedToUserId) {
      await this.ensureAssignee(trip, payload.assignedToUserId);
    }

    const item = await this.checklistRepository.create({
      tripId: trip.id,
      title: payload.title,
      category: payload.category ?? null,
      assignedToUserId: payload.assignedToUserId ?? null
    });

    this.logger.info("Checklist item created", {
      userId,
      tripId,
      itemId: item.id
    });

    return this.toResponse(item);
  }

  /**
   * Partially update an item. Ticking records who checked it and when;
   * unticking clears that.
   */
  async update(
    userId: string,
    tripId: string,
    itemId: string,
    payload: UpdateChecklistItemDto
  ): Promise<ChecklistItemResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const item = await this.findItem(trip.id, itemId);

    if (payload.assignedToUserId) {
      await this.ensureAssignee(trip, payload.assignedToUserId);
    }

    const checkChanged =
      payload.isChecked !== undefined && payload.isChecked !== item.isChecked;

    const updated = await this.checklistRepository.update(item.id, {
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.assignedToUserId !== undefined && {
        assignedToUserId: payload.assignedToUserId
      }),
      ...(checkChanged && {
        isChecked: payload.isChecked,
        checkedAt: payload.isChecked ? new Date() : null,
        checkedByUserId: payload.isChecked ? userId : null
      })
    });

    this.logger.info("Checklist item updated", { userId, tripId, itemId });

    if (checkChanged) {
      this.activity.publish({
        tripId: trip.id,
        actorUserId: userId,
        action: payload.isChecked
          ? "checklist.item_checked"
          : "checklist.item_unchecked",
        data: { title: updated.title }
      });
    }

    return this.toResponse(updated);
  }

  async remove(userId: string, tripId: string, itemId: string): Promise<void> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const item = await this.findItem(trip.id, itemId);

    await this.checklistRepository.delete(item.id);

    this.logger.info("Checklist item deleted", { userId, tripId, itemId });
  }
}
