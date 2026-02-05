import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MapsService {
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!key) {
      throw new Error('GOOGLE_MAPS_API_KEY missing. Put it in .env');
    }
    this.apiKey = key;
  }

  async geocodeAddress(address: string) {
    try {
      const url = 'https://maps.googleapis.com/maps/api/geocode/json';
      const { data } = await axios.get(url, {
        params: { address, key: this.apiKey },
      });

      if (data.status !== 'OK') {
        return {
          ok: false,
          status: data.status,
          error_message: data.error_message,
          results: [],
        };
      }

      const r0 = data.results?.[0];
      return {
        ok: true,
        status: data.status,
        formatted_address: r0?.formatted_address,
        location: r0?.geometry?.location, // { lat, lng }
        place_id: r0?.place_id,
        types: r0?.types,
      };
    } catch (e: any) {
      throw new InternalServerErrorException(
        `Geocode failed: ${e?.message ?? 'unknown error'}`,
      );
    }
  }

  async reverseGeocode(lat: number, lng: number) {
    try {
      const url = 'https://maps.googleapis.com/maps/api/geocode/json';
      const { data } = await axios.get(url, {
        params: { latlng: `${lat},${lng}`, key: this.apiKey },
      });

      if (data.status !== 'OK') {
        return {
          ok: false,
          status: data.status,
          error_message: data.error_message,
          results: [],
        };
      }

      const r0 = data.results?.[0];

      // locality bazen gelmez, o yüzden admin_area_level_1 fallback
      const comps = r0?.address_components ?? [];
      const locality =
        comps.find((c: any) => c.types?.includes('locality'))?.long_name ??
        null;
      const admin1 =
        comps.find((c: any) => c.types?.includes('administrative_area_level_1'))
          ?.long_name ?? null;

      const city = locality ?? admin1;

      return {
        ok: true,
        status: data.status,
        formatted_address: r0?.formatted_address,
        city,
        location: r0?.geometry?.location,
        place_id: r0?.place_id,
        types: r0?.types,
      };
    } catch (e: any) {
      throw new InternalServerErrorException(
        `Reverse geocode failed: ${e?.message ?? 'unknown error'}`,
      );
    }
  }

  async computeRoute(opts: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    travelMode: 'DRIVE' | 'TWO_WHEELER' | 'WALK' | 'BICYCLE';
    routingPreference:
      | 'TRAFFIC_AWARE'
      | 'TRAFFIC_AWARE_OPTIMAL'
      | 'ROUTING_PREFERENCE_UNSPECIFIED';
  }) {
    try {
      const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

      const body = {
        origin: {
          location: {
            latLng: { latitude: opts.origin.lat, longitude: opts.origin.lng },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: opts.destination.lat,
              longitude: opts.destination.lng,
            },
          },
        },
        travelMode: opts.travelMode,
        routingPreference: opts.routingPreference,
      };

      const { data } = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask':
            'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        },
      });

      const r0 = data?.routes?.[0];

      return {
        ok: true,
        distanceMeters: r0?.distanceMeters,
        duration: r0?.duration, // "1640s"
        encodedPolyline: r0?.polyline?.encodedPolyline,
      };
    } catch (e: any) {
      // Google bazen response içine error objesi koyabiliyor
      const msg =
        e?.response?.data?.error?.message ?? e?.message ?? 'unknown error';

      throw new InternalServerErrorException(`Route failed: ${msg}`);
    }
  }
}
