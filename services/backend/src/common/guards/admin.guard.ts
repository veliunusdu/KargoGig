import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { headers: any }>();

    const authHeader = req.headers?.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];

    if (!token) throw new UnauthorizedException('Missing bearer token');

    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_ANON_KEY!;
    if (!url || !anon) throw new InternalServerErrorException('Supabase env missing');

    // client bound to the user's token → auth.uid() works in Postgres RPC
    const sb = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validate token
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user?.id) {
      throw new UnauthorizedException('Invalid token');
    }

    // RPC must exist: public.is_admin() returns boolean
    const { data: isAdmin, error: rpcErr } = await sb.rpc('is_admin');
    if (rpcErr) {
      throw new InternalServerErrorException({
        message: 'Admin check failed',
        details: rpcErr.message,
      });
    }

    if (!isAdmin) throw new ForbiddenException('Admin privileges required');
    return true;
  }
}
