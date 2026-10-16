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

@Module({
  imports: [UsersModule],
  controllers: [TripsController, ItineraryController, MembersController],
  providers: [
    TripsService,
    TripsRepository,
    TripAccessService,
    ItineraryService,
    ItineraryRepository,
    MembersService,
    MembersRepository
  ]
})
export class TripsModule {}
