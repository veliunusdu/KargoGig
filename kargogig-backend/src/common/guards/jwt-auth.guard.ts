
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // Use Supabase service role client to verify the token
      const { data, error } = await this.supabase.getServiceClient().auth.getUser(token);

      if (error || !data.user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Populate req.user for use in controllers
      // Specifically populate sub for user id compatibility with existing TODOs
      request.user = {
        ...data.user,
        sub: data.user.id,
      };

      return true;
    } catch (err) {
      throw new UnauthorizedException('Token verification failed');
    }
  }
}
