import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { MapsService } from './maps.service';

@Controller('maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  // GET /maps/geocode?address=Istanbul
  @Get('geocode')
  async geocode(@Query('address') address?: string) {
    if (!address || !address.trim()) {
      throw new BadRequestException('address query param is required');
    }
    return this.maps.geocodeAddress(address.trim());
  }

  // GET /maps/reverse?lat=41.0082&lng=28.9784
  @Get('reverse')
  async reverse(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new BadRequestException('lat and lng must be valid numbers');
    }

    return this.maps.reverseGeocode(latNum, lngNum);
  }

  // POST /maps/route
  // body: { origin:{lat,lng}, destination:{lat,lng}, travelMode?, routingPreference? }
  @Post('route')
  async route(
    @Body()
    body: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      travelMode?: 'DRIVE' | 'TWO_WHEELER' | 'WALK' | 'BICYCLE';
      routingPreference?: 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL' | 'ROUTING_PREFERENCE_UNSPECIFIED';
    },
  ) {
    if (!body?.origin || !body?.destination) {
      throw new BadRequestException('origin and destination are required');
    }

    const { origin, destination } = body;

    if (
      !Number.isFinite(origin.lat) ||
      !Number.isFinite(origin.lng) ||
      !Number.isFinite(destination.lat) ||
      !Number.isFinite(destination.lng)
    ) {
      throw new BadRequestException('origin/destination lat,lng must be numbers');
    }

    return this.maps.computeRoute({
      origin,
      destination,
      travelMode: body.travelMode ?? 'DRIVE',
      routingPreference: body.routingPreference ?? 'TRAFFIC_AWARE',
    });
  }
}
