import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { mapRpcErrorToHttp } from './rpc-error.util';

describe('mapRpcErrorToHttp', () => {
  it('should return InternalServerErrorException for null error', () => {
    const result = mapRpcErrorToHttp(null);
    expect(result).toBeInstanceOf(InternalServerErrorException);
    expect(result.message).toBe('Unknown RPC error');
  });

  describe('401 Unauthorized', () => {
    it.each(['not authenticated', 'authentication required'])(
      'should map message containing "%s" to UnauthorizedException',
      (msg) => {
        const error: PostgrestError = {
          message: `Error: ${msg}`,
          details: '',
          hint: '',
          code: '',
        };
        const result = mapRpcErrorToHttp(error);
        expect(result).toBeInstanceOf(UnauthorizedException);
        expect(result.message).toBe(error.message);
      },
    );
  });

  describe('403 Forbidden', () => {
    it.each([
      'forbidden',
      'not a driver',
      'shipment not assigned to this driver',
      'permission denied',
      'access denied',
    ])('should map message containing "%s" to ForbiddenException', (msg) => {
      const error: PostgrestError = {
        message: `Error: ${msg}`,
        details: '',
        hint: '',
        code: '',
      };
      const result = mapRpcErrorToHttp(error);
      expect(result).toBeInstanceOf(ForbiddenException);
      expect(result.message).toBe(error.message);
    });
  });

  describe('404 Not Found', () => {
    it.each([
      'not found',
      'no shipment for announcement',
      'announcement not found',
      'shipment not found',
    ])('should map message containing "%s" to NotFoundException', (msg) => {
      const error: PostgrestError = {
        message: `Error: ${msg}`,
        details: '',
        hint: '',
        code: '',
      };
      const result = mapRpcErrorToHttp(error);
      expect(result).toBeInstanceOf(NotFoundException);
      expect(result.message).toBe(error.message);
    });
  });

  describe('422 Unprocessable Entity', () => {
    it.each([
      'geo-fence failed',
      'geofence failed',
      'too far from pickup',
      'too far from dropoff',
      'driver location missing',
      'location not available',
      'invalid coordinates',
      'invalid lat',
      'invalid lng',
    ])('should map message containing "%s" to UnprocessableEntityException', (msg) => {
      const error: PostgrestError = {
        message: `Error: ${msg}`,
        details: '',
        hint: '',
        code: '',
      };
      const result = mapRpcErrorToHttp(error);
      expect(result).toBeInstanceOf(UnprocessableEntityException);
      expect(result.message).toBe(error.message);
    });
  });

  describe('409 Conflict', () => {
    it.each([
      'cannot cancel after pickup',
      'cannot cancel after in_transit',
      'already cancelled',
      'already arrived',
      'already started',
      'already completed',
      'cannot start: not arrived',
      'cannot complete: not in progress',
      'must arrive before starting',
      'not in progress',
      'shipment not in progress',
      'ride not active',
      'invalid state',
      'state conflict',
    ])('should map message containing "%s" to ConflictException', (msg) => {
      const error: PostgrestError = {
        message: `Error: ${msg}`,
        details: '',
        hint: '',
        code: '',
      };
      const result = mapRpcErrorToHttp(error);
      expect(result).toBeInstanceOf(ConflictException);
      expect(result.message).toBe(error.message);
    });

    it('should map details containing "conflict" to ConflictException', () => {
      const error: PostgrestError = {
        message: 'some message',
        details: 'there was a conflict here',
        hint: '',
        code: '',
      };
      const result = mapRpcErrorToHttp(error);
      expect(result).toBeInstanceOf(ConflictException);
    });
  });

  describe('400 Bad Request', () => {
    it.each(['23503', '23505', '22P02'])(
      'should map error code "%s" to BadRequestException',
      (code) => {
        const error: PostgrestError = {
          message: 'some error',
          details: '',
          hint: '',
          code: code,
        };
        const result = mapRpcErrorToHttp(error);
        expect(result).toBeInstanceOf(BadRequestException);
        expect(result.message).toBe(error.message);
      },
    );

    it.each(['invalid', 'required'])(
      'should map message containing "%s" to BadRequestException',
      (msg) => {
        const error: PostgrestError = {
          message: `Some ${msg} field`,
          details: '',
          hint: '',
          code: '',
        };
        const result = mapRpcErrorToHttp(error);
        expect(result).toBeInstanceOf(BadRequestException);
        expect(result.message).toBe(error.message);
      },
    );
  });

  describe('500 Internal Server Error', () => {
    it('should fallback to InternalServerErrorException for unmapped errors', () => {
      const error: PostgrestError = {
        message: 'Something went wrong on the server',
        details: '',
        hint: '',
        code: 'UNKNOWN_CODE',
      };
      const result = mapRpcErrorToHttp(error);
      expect(result).toBeInstanceOf(InternalServerErrorException);
      expect(result.message).toBe(error.message);
    });
  });
});
