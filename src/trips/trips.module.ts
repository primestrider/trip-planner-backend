import { Module } from "@nestjs/common";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
import { TripsRepository } from "./trips.repository";
import { ItineraryController } from "./itinerary/itinerary.controller";
import { ItineraryService } from "./itinerary/itinerary.service";
import { ItineraryRepository } from "./itinerary/itinerary.repository";

@Module({
  controllers: [TripsController, ItineraryController],
  providers: [
    TripsService,
    TripsRepository,
    ItineraryService,
    ItineraryRepository
  ]
})
export class TripsModule {}
