import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { TripMember } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { UsersService } from "src/users/users.service";
import { TripAccessService } from "../trip-access.service";
import {
  MemberUser,
  MembersRepository,
  TripMemberWithUser
} from "./members.repository";
import { TripMemberResponse } from "./models";
import { AddMemberDto, UpdateMemberDto } from "./members.validation";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * MembersService manages collaborators of a trip.
 *
 * - Any member can see who is on the trip.
 * - Only the owner can add members, change roles, or remove others.
 * - A collaborator can leave the trip by removing themselves.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly membersRepository: MembersRepository,
    private readonly usersService: UsersService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private toResponse(member: TripMemberWithUser): TripMemberResponse {
    return {
      userId: member.user.id,
      username: member.user.username,
      name: member.user.name,
      avatar: member.user.avatar,
      role: member.role,
      joinedAt: member.createdAt
    };
  }

  private toOwnerResponse(owner: MemberUser): TripMemberResponse {
    return {
      userId: owner.id,
      username: owner.username,
      name: owner.name,
      avatar: owner.avatar,
      role: "OWNER",
      joinedAt: null
    };
  }

  /**
   * @throws NotFoundException if user is not a collaborator of the trip
   */
  private async findMember(
    tripId: string,
    memberUserId: string
  ): Promise<TripMember> {
    const member = await this.membersRepository.findByTripAndUser(
      tripId,
      memberUserId
    );

    if (!member) {
      throw new NotFoundException("Member not found");
    }

    return member;
  }

  /**
   * List owner followed by collaborators.
   */
  async list(userId: string, tripId: string): Promise<TripMemberResponse[]> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);

    const [owner, members] = await Promise.all([
      this.membersRepository.findOwner(trip.userId),
      this.membersRepository.findManyByTrip(trip.id)
    ]);

    return [
      ...(owner ? [this.toOwnerResponse(owner)] : []),
      ...members.map((member) => this.toResponse(member))
    ];
  }

  /**
   * Add a user to the trip by username. Owner only.
   *
   * @throws NotFoundException if the user does not exist or is inactive
   * @throws ConflictException if the user is the owner or already a member
   */
  async add(
    userId: string,
    tripId: string,
    payload: AddMemberDto
  ): Promise<TripMemberResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");

    const user = await this.usersService.findByUsername(payload.username);

    if (!user || !user.isActive || user.deletedAt) {
      throw new NotFoundException("User not found");
    }

    if (user.id === trip.userId) {
      throw new ConflictException("User is the owner of this trip");
    }

    try {
      const member = await this.membersRepository.create(
        trip.id,
        user.id,
        payload.role
      );

      this.logger.info("Trip member added", {
        userId,
        tripId,
        memberUserId: user.id,
        role: payload.role
      });

      return this.toResponse(member);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("User is already a member of this trip");
      }

      throw error;
    }
  }

  /**
   * Change role of a collaborator. Owner only.
   */
  async updateRole(
    userId: string,
    tripId: string,
    memberUserId: string,
    payload: UpdateMemberDto
  ): Promise<TripMemberResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");
    const member = await this.findMember(trip.id, memberUserId);

    const updated = await this.membersRepository.updateRole(
      member.id,
      payload.role
    );

    this.logger.info("Trip member role changed", {
      userId,
      tripId,
      memberUserId,
      role: payload.role
    });

    return this.toResponse(updated);
  }

  /**
   * Remove a collaborator.
   * The owner can remove anyone; a collaborator can only remove themselves.
   *
   * @throws BadRequestException if the owner tries to leave their own trip
   * @throws ForbiddenException if a collaborator tries to remove someone else
   */
  async remove(
    userId: string,
    tripId: string,
    memberUserId: string
  ): Promise<void> {
    const { trip, role } = await this.tripAccess.getTrip(userId, tripId);

    if (memberUserId === trip.userId) {
      throw new BadRequestException(
        "The owner cannot leave the trip; delete the trip instead"
      );
    }

    if (role !== "OWNER" && memberUserId !== userId) {
      throw new ForbiddenException("Only the owner can remove other members");
    }

    const member = await this.findMember(trip.id, memberUserId);

    await this.membersRepository.delete(member.id);

    this.logger.info("Trip member removed", { userId, tripId, memberUserId });
  }
}
