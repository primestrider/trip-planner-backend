import { createHash, randomBytes } from "crypto";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { TripInvite } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService, roleOf } from "../trip-access.service";
import { TripsRepository } from "../trips.repository";
import { InvitesRepository, InviteWithTrip } from "./invites.repository";
import {
  AcceptInviteResponse,
  CreatedInviteResponse,
  InvitePreviewResponse,
  InviteResponse,
  InviteStatus
} from "./models";
import { CreateInviteDto } from "./invites.validation";
import { addDays, toDateString } from "src/utils/date";

// 32 random bytes encoded as base64url
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function statusOf(invite: TripInvite, now = new Date()): InviteStatus {
  if (invite.revokedAt) return "REVOKED";
  if (invite.expiresAt <= now) return "EXPIRED";
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return "USED_UP";
  }
  return "ACTIVE";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * InvitesService lets the trip owner share a link that any signed-in
 * user can open to join the trip with the role set on the link.
 *
 * Only a SHA-256 hash of the token is stored, so a link is shown once
 * at creation; a lost link is revoked and replaced.
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly tripsRepository: TripsRepository,
    private readonly invitesRepository: InvitesRepository,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private toResponse(invite: TripInvite): InviteResponse {
    return {
      id: invite.id,
      role: invite.role,
      status: statusOf(invite),
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      useCount: invite.useCount,
      revokedAt: invite.revokedAt,
      createdAt: invite.createdAt
    };
  }

  /**
   * Find a usable invite by its token.
   * Unknown, revoked, expired and used-up invites look the same to the caller.
   *
   * @throws NotFoundException
   */
  private async findUsableInvite(token: string): Promise<InviteWithTrip> {
    const invite = TOKEN_PATTERN.test(token)
      ? await this.invitesRepository.findByTokenHash(hashToken(token))
      : null;

    if (!invite || statusOf(invite) !== "ACTIVE") {
      throw new NotFoundException("Invite link is invalid or has expired");
    }

    return invite;
  }

  /**
   * Create an invite link. Owner only.
   */
  async create(
    userId: string,
    tripId: string,
    payload: CreateInviteDto
  ): Promise<CreatedInviteResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");

    const token = randomBytes(32).toString("base64url");

    const invite = await this.invitesRepository.create({
      tripId: trip.id,
      tokenHash: hashToken(token),
      role: payload.role,
      expiresAt: addDays(new Date(), payload.expiresInDays),
      maxUses: payload.maxUses ?? null
    });

    this.logger.info("Trip invite created", {
      userId,
      tripId,
      inviteId: invite.id
    });

    return { ...this.toResponse(invite), token };
  }

  /**
   * List invites of a trip, newest first. Owner only.
   */
  async list(userId: string, tripId: string): Promise<InviteResponse[]> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");
    const invites = await this.invitesRepository.findManyByTrip(trip.id);

    return invites.map((invite) => this.toResponse(invite));
  }

  /**
   * Revoke an invite so its link stops working. Owner only.
   */
  async revoke(
    userId: string,
    tripId: string,
    inviteId: string
  ): Promise<InviteResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");
    const invite = await this.invitesRepository.findByIdAndTrip(
      inviteId,
      trip.id
    );

    if (!invite) {
      throw new NotFoundException("Invite not found");
    }

    if (invite.revokedAt) {
      return this.toResponse(invite);
    }

    const revoked = await this.invitesRepository.revoke(invite.id);

    this.logger.info("Trip invite revoked", { userId, tripId, inviteId });

    return this.toResponse(revoked);
  }

  /**
   * Show the trip behind an invite link before joining.
   */
  async preview(userId: string, token: string): Promise<InvitePreviewResponse> {
    const invite = await this.findUsableInvite(token);
    const membership = await this.tripsRepository.findByIdForUser(
      invite.tripId,
      userId
    );

    return {
      trip: {
        id: invite.trip.id,
        title: invite.trip.title,
        destination: invite.trip.destination,
        startDate: toDateString(invite.trip.startDate),
        endDate: toDateString(invite.trip.endDate)
      },
      invitedBy: invite.trip.user,
      role: invite.role,
      expiresAt: invite.expiresAt,
      currentRole: membership ? roleOf(membership, userId) : null
    };
  }

  /**
   * Join the trip through an invite link.
   * Users already on the trip keep their role and do not use the invite.
   *
   * @throws NotFoundException if the link is invalid, expired, revoked or used up
   */
  async accept(userId: string, token: string): Promise<AcceptInviteResponse> {
    const invite = await this.findUsableInvite(token);

    const membership = await this.tripsRepository.findByIdForUser(
      invite.tripId,
      userId
    );

    if (membership) {
      return {
        tripId: invite.tripId,
        role: roleOf(membership, userId),
        alreadyMember: true
      };
    }

    let redeemed: boolean;
    try {
      redeemed = await this.invitesRepository.redeem(
        invite,
        userId,
        invite.role
      );
    } catch (error: unknown) {
      // joined concurrently through another request
      if (isUniqueViolation(error)) {
        throw new ConflictException("You are already a member of this trip");
      }
      throw error;
    }

    if (!redeemed) {
      throw new NotFoundException("Invite link is invalid or has expired");
    }

    this.logger.info("Trip invite accepted", {
      userId,
      tripId: invite.tripId,
      inviteId: invite.id
    });

    return { tripId: invite.tripId, role: invite.role, alreadyMember: false };
  }
}
