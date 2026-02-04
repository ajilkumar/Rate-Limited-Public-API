import { ApiKey, RateLimitInfo } from './index';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      apiKey?: ApiKey;
      rateLimit?: RateLimitInfo;
    }
  }
}