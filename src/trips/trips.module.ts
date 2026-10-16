import { Module } from "@nestjs/common";
import { UsersModule } from "src/users/users.module";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
import { TripsRepository } from "./trips.repository";
import { TripAccessService } from "./trip-access.service";
import { ItineraryController } from "./itinerary/itinerary.controller";
import { ItineraryService } from "./itinerary/itinerary.service";
import { ItineraryRepository } from "./itinerary/itinerary.repository";
import { MembersController } from "./members/members.controller";
import { MembersService } from "./members/members.service";
import { MembersRepository } from "./members/members.repository";
import { AccommodationsController } from "./accommodations/accommodations.controller";
import { AccommodationsService } from "./accommodations/accommodations.service";
import { AccommodationsRepository } from "./accommodations/accommodations.repository";
import { TransportsController } from "./transports/transports.controller";
import { TransportsService } from "./transports/transports.service";
import { TransportsRepository } from "./transports/transports.repository";
import { ExpensesController } from "./expenses/expenses.controller";
import { ExpensesService } from "./expenses/expenses.service";
import { ExpensesRepository } from "./expenses/expenses.repository";
import {
  InvitesController,
  TripInvitesController
} from "./invites/invites.controller";
import { InvitesService } from "./invites/invites.service";
import { InvitesRepository } from "./invites/invites.repository";
import { ChecklistController } from "./checklist/checklist.controller";
import { ChecklistService } from "./checklist/checklist.service";
import { ChecklistRepository } from "./checklist/checklist.repository";

@Module({
  imports: [UsersModule],
  controllers: [
    TripsController,
    ItineraryController,
    MembersController,
    AccommodationsController,
    TransportsController,
    ExpensesController,
    TripInvitesController,
    InvitesController,
    ChecklistController
  ],
  providers: [
    TripsService,
    TripsRepository,
    TripAccessService,
    ItineraryService,
    ItineraryRepository,
    MembersService,
    MembersRepository,
    AccommodationsService,
    AccommodationsRepository,
    TransportsService,
    TransportsRepository,
    ExpensesService,
    ExpensesRepository,
    InvitesService,
    InvitesRepository,
    ChecklistService,
    ChecklistRepository
  ]
})
export class TripsModule {}
