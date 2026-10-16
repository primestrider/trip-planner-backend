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

@Module({
  imports: [UsersModule],
  controllers: [
    TripsController,
    ItineraryController,
    MembersController,
    AccommodationsController,
    TransportsController
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
    TransportsRepository
  ]
})
export class TripsModule {}
